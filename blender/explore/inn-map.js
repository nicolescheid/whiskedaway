// The Inn map (Nicole, 23 Oct; inn-map-plan.md): the bar's Map button opens a floor plan of the Inn. Tap a room and you walk
// there; "✦ Where my wander points" walks to the room your wander leans to; "In this room" underneath lists every hotspot in
// the room you're in (how keyboard and screen-reader visitors reach each one). It's a layer (explore/layers.js).
// The plan's rooms, shapes and words are data: explore/inn-map.json (content and art). A room whose ROOMS entry isn't built yet
// (the garden) shows its "soon" line instead and can't be entered.
import { sound } from './sound.js';
import { layers } from './layers.js';

const NS = 'http://www.w3.org/2000/svg';
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
// A short line in at most two rows of about `max` letters
const rows = (t, max) => {
  const out = [''];
  for (const w of String(t || '').split(' ')) {
    if (out.at(-1) && (out.at(-1) + ' ' + w).length > max) out.push(w); else out[out.length - 1] = (out.at(-1) ? out.at(-1) + ' ' : '') + w;
  }
  return out.slice(0, 2);
};

export function install(inn) {
  const M = inn.innMapData || {};
  const esc = inn.esc;
  const root = document.createElement('div');
  root.id = 'inn-map';
  root.className = 'tell im-sheet';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'im-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box im-box">
      <header class="tl-head"><h2 id="im-title">${esc(M.title || 'The Inn')}</h2><button class="tl-x" aria-label="Close">✕</button></header>
      <div class="tl-body">
        <p class="small im-sub">${esc(M.sub || 'Tap a room to walk there.')}</p>
        <div class="im-plan"></div>
        <p class="im-said small" role="status"></p>
        <button type="button" class="im-star">✦ ${esc(M.star || 'Where my wander points')}</button>
        <h3 class="im-h">${esc(M.inThisRoom || 'In this room')}</h3>
        <p class="small">${esc(M.inThisRoomSub || 'Everything in this room, always in the same place.')}</p>
        <p class="im-sub2">${esc(M.tools || 'Tools')}</p><ul class="im-list im-tools"></ul>
        <p class="im-sub2">${esc(M.things || 'In the room')}</p><ul class="im-list im-things"></ul>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const chip = inn.$('btn-map');
  let layer = null;

  // Which room on the plan the visitor is in: a ROOMS key, or the plan room whose go it is (the hallway's two stops)
  const here = () => inn.state.room;
  const built = r => !!inn.ROOMS[r.go];

  function el(name, attrs = {}, text) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  /** The plan, drawn fresh on each open (the "you're here" moves, and the garden lights up once it's built) */
  function drawPlan() {
    const svg = el('svg', { viewBox: '0 0 340 330', class: 'im-svg', role: 'group', 'aria-label': M.title || 'The Inn' });
    for (const o of M.outside || []) {
      const [x, y, w, h] = o.shape;
      svg.append(el('rect', { x, y, width: w, height: h, class: `im-${o.kind}`, 'aria-hidden': 'true' }));
      if (o.label) svg.append(el('text', { x: x + w / 2, y: y + h / 2 + 4, class: 'im-edge', 'text-anchor': 'middle', 'aria-hidden': 'true' }, o.label));
    }
    for (const r of M.rooms || []) {
      const [x, y, w, h] = r.shape, open = built(r), isHere = open && r.go === here();
      const line = open ? r.line : r.soon;
      // A link to the room (?room=), so it's a real link for keyboards and screen readers; a tap walks there instead
      const a = el(open ? 'a' : 'g', { class: `im-room${isHere ? ' here' : ''}${open ? '' : ' soon'}`, 'data-go': r.go,
        ...(open ? { href: `?room=${encodeURIComponent(r.go)}` } : { role: 'button', tabindex: '0' }),
        'aria-label': `${r.label}${line ? `: ${line}` : ''}${isHere ? `. ${M.here || "You're here"}` : ''}`, ...(isHere ? { 'aria-current': 'location' } : {}) });
      a.append(el('rect', { x, y, width: w, height: h, class: 'im-shape' }));
      const cx = r.at ? r.at[0] : x + w / 2, cy = r.at ? r.at[1] : y + h / 2;
      if (r.upright) {
        const t = el('text', { x: cx, y: cy + 4, class: 'im-name', 'text-anchor': 'middle', transform: `rotate(-90 ${cx} ${cy})` }, r.label);
        a.append(t);
        if (!open && line) a.append(el('text', { x: cx + 12, y: cy + 4, class: 'im-line', 'text-anchor': 'middle', transform: `rotate(-90 ${cx + 12} ${cy})` }, line));
        if (isHere) a.append(el('circle', { cx: x + w / 2, cy: y + 10, r: 4.5, class: 'im-dot' }));
      } else {
        const ls = rows(line, Math.max(10, Math.floor((w - 10) / 5.6)));
        const top = cy - (ls.length * 12.5 + (isHere ? 13 : 0)) / 2;
        a.append(el('text', { x: cx, y: top + 2, class: 'im-name', 'text-anchor': 'middle' }, r.label));
        ls.forEach((t, i) => a.append(el('text', { x: cx, y: top + 15 + i * 12.5, class: 'im-line', 'text-anchor': 'middle' }, t)));
        if (isHere) {
          const yy = top + 16 + ls.length * 12.5;
          a.append(el('circle', { cx: cx - 30, cy: yy - 3.5, r: 3.5, class: 'im-dot' }));
          a.append(el('text', { x: cx + 4, y: yy, class: 'im-here', 'text-anchor': 'middle' }, M.here || "You're here"));
        }
      }
      svg.append(a);
    }
    if (M.stairs) {
      const [x, y, w, h] = M.stairs.shape;
      const g = el('g', { class: 'im-stairs', role: 'button', tabindex: '0', 'aria-label': `${M.stairs.label}: ${M.stairs.line}` });
      g.append(el('rect', { x, y, width: w, height: h, class: 'im-shape' }));
      for (let i = 1; i < 6; i++) g.append(el('line', { x1: x + i * w / 6, y1: y + 3, x2: x + i * w / 6, y2: y + h - 3, 'aria-hidden': 'true' }));
      g.append(el('text', { x: x + w / 2, y: y + h / 2 - 2, class: 'im-line strong', 'text-anchor': 'middle' }, `${M.stairs.label}:`));
      g.append(el('text', { x: x + w / 2, y: y + h / 2 + 10, class: 'im-line strong', 'text-anchor': 'middle' }, M.stairs.line));
      svg.append(g);
    }
    for (const [x, y, w, h] of M.doors || []) svg.append(el('rect', { x, y, width: w, height: h, class: 'im-door', 'aria-hidden': 'true' }));
    const plan = $('.im-plan');
    plan.replaceChildren(svg);
    svg.querySelectorAll('.im-room').forEach(a => {
      const r = M.rooms.find(x => x.go === a.dataset.go);
      const act = e => { e.preventDefault(); built(r) ? walk(r.go) : note(r.soonSay || r.soon); };
      a.addEventListener('click', act);
      if (!built(r)) a.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') act(e); });
    });
    const st = svg.querySelector('.im-stairs');
    if (st) {
      const act = e => { e.preventDefault(); note(M.stairs.say); };
      st.addEventListener('click', act);
      st.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') act(e); });
    }
  }
  /** "In this room": every hotspot here, tools first, as the old Map list had them */
  function fillList() {
    $('.im-tools').innerHTML = $('.im-things').innerHTML = '';
    for (const [id, o] of Object.entries(inn.world.objects)) {
      if (!inn.spots[id] || o.map_hide) continue;
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.map || inn.label(id);
      if (o.blurb) { b.insertAdjacentHTML('beforeend', `<span class="blurb">${esc(o.blurb)}</span>`); b.setAttribute('aria-label', `${b.firstChild.textContent}: ${o.blurb}`); }
      b.onclick = () => close(() => {
        const s = inn.spots[id];
        if (!s) return;
        inn.hasLooked = true;
        inn.lookTo(s.yaw, s.pitch);
        inn.record({ kind: 'map', id });
      });
      li.appendChild(b);
      $(o.type === 'ambient' ? '.im-things' : '.im-tools').appendChild(li);
    }
  }
  const note = t => { $('.im-said').textContent = t || ''; };

  function open() {
    if (!root.hidden) return;
    inn.ideas?.close?.(false);
    drawPlan();
    fillList();
    note('');
    root.hidden = false;
    root.className = `tell im-sheet ${mode()}`;
    layer = layers.open({ el: root, name: 'inn-map', opener: chip, expands: chip, close: how => close(null, how) });
    chip.classList.add('on');
    inn.track('map_open', { room: inn.state.room });
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    ($('.im-room.here') || $('.im-room[href]'))?.focus({ preventScroll: true });
  }
  /** Close; then(), if given, runs once the map's step back in history has landed (a room move replaces the address) */
  function close(then = null, how = 'self') {
    if (root.hidden) return;
    root.hidden = true;
    chip.classList.remove('on');
    layers.closed(layer, { how: how === 'back' ? 'back' : 'self' });
    if (then) layers.afterBack(then);
  }
  // Tap a room: the door, "In you go." and a short pause, as the dial did. Where you are already: she says so
  function walk(go) {
    if (go === here()) { note("You're already here."); return; }
    close(() => {
      inn.track('inn_map_go', { from_room: inn.state.room, room: go });
      sound.door?.();
      inn.say('In you go.', [], true);
      setTimeout(() => inn.goRoom(go), reduce() ? 0 : 700);
    });
  }
  $('.im-star').onclick = () => {
    const go = inn.wanderRoom();
    if (go === here()) { note("Your wander says here. You're already in it."); return; }
    close(() => {
      inn.track('inn_map_star', { room: go });
      const says = { flourish: 'Your wander says Flourish. In you go.', 'sweet-spells': 'Your wander says Sweet Spells. In you go.',
                     chiapothecary: 'Your wander says the Chiapothecary. In you go.',
                     'garden-patio': 'Your wander says the garden. Out you go.' };
      inn.say(says[go] || 'Your wander says Cuddlecore. In you go.', [], true);
      setTimeout(() => inn.goRoom(go), reduce() ? 0 : 700);
    });
  };
  $('.tl-x').onclick = () => close();
  $('.tl-dim').onclick = () => close();
  addEventListener('resize', () => { if (!root.hidden) root.className = `tell im-sheet ${mode()}`; });
  chip.onclick = () => (root.hidden ? open() : close());

  inn.innMap = { open, close, get isOpen() { return !root.hidden; } };
}
