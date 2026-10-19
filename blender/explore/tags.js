// "What you've told Gemma" as tags (ux-journey-stage1.md, Inn rule 11; recipe-book-ux.md v4 §4b): one small tag per
// about-you value in the visit store (🕯 low · 🌱 vegetarian …), shown in the chat's Short and Full sizes on phones and in its
// header on desktop. Tap a tag to change or forget it from any room, with the same choices as the object that owns it.
// A tag appears only once a value is set. New keys: add a renderer to KINDS. Pantry, the map and dietary needs open their
// Tell Gemma sheet (tell.js); energy keeps its small picker. "+ Tell me about you" always ends the row (the empty state too).

import { DIETS } from './writeout.js';
import { cuisineLabel } from './tell.js';
import { SERVINGS, checkinWords } from './checkin.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createTags({ el, visit, world, choose, tell, chipLabel = '+ Tell me about you', lines = {} }) {
  const W = checkinWords(lines);
  // The check-in's answers (checkin.js): a small picker like energy's, and the same setter as the desk's sheet (choose.answer)
  const answer = (k, icon, name, ids) => ({ icon, name, title: W.rows[k], word: v => (W[k][v] || '').toLowerCase(),
    options: () => ids.map(id => ({ id, label: W[k][id] })), pick: id => choose.answer(k, id) });
  // Each kind: its icon, its words for a value, the picker's options and how a pick is made
  const KINDS = {
    energy: {
      icon: '🕯', name: 'Energy', title: 'How much have you got in you today?',
      word: v => world.energies?.[v]?.label?.toLowerCase(),
      options: () => Object.entries(world.energies || {}).map(([id, e]) => ({ id, label: e.label })),
      pick: id => choose.energy(id),
    },
    // Dietary needs: the cookbook shelf's sheet, or the recipe page's "Anything I should avoid?". "Something else" shows as +1
    dietary: {
      icon: '🌱', name: 'Dietary needs', title: 'Anything I should avoid?', multi: true, sheet: 'dietary',
      word: v => [].concat(v || []).map(d => DIETS.find(([id]) => id === d)?.[1].toLowerCase() || d).join(', ') + (visit.get('dietaryOther') ? ' +1' : ''),
      options: () => DIETS.map(([id, label]) => ({ id, label })),
      pick: id => { const now = [].concat(visit.get('dietary') || []); const next = now.includes(id) ? now.filter(x => x !== id) : [...now, id]; visit.set('dietary', next.length ? next : null); },
    },
    // "Something else" on its own (no chips chosen) still gets the dietary tag
    dietaryOther: { icon: '🌱', name: 'Dietary needs', sheet: 'dietary', word: v => (v && !visit.get('dietary') ? 'something else' : '') },
    pantry: {
      icon: '🥫', name: 'Pantry', sheet: 'pantry',
      word: v => { const items = Array.isArray(v) ? v : v?.items || []; return items.length ? items.slice(0, 2).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '') : ''; },
    },
    cuisines: { icon: '🗺', name: 'The map', sheet: 'map', word: v => [].concat(v || []).map(cuisineLabel).join(', ') },   // the country is in the sheet only
    time: answer('time', '⏳', 'Time', Object.keys(W.time)),
    servings: { ...answer('servings', '🍽', 'Cooking for', SERVINGS), word: v => (v === '1' || v === 'crowd' ? W.servings[v] : `for ${W.servings[v] || v}`).toLowerCase() },
    confidence: answer('confidence', '🧑‍🍳', 'Confidence', Object.keys(W.confidence)),
  };
  el.setAttribute('role', 'list');
  el.setAttribute('aria-label', "What you've told Gemma");
  const pick = document.createElement('div');
  pick.className = 'tag-pick';
  pick.hidden = true;
  pick.setAttribute('role', 'dialog');
  pick.setAttribute('aria-labelledby', 'tag-pick-title');
  document.body.appendChild(pick);
  let opener = null;

  function render() {
    const about = visit.all().about;
    const rows = Object.entries(about).filter(([k, v]) => KINDS[k] && KINDS[k].word(v));
    el.innerHTML = rows.map(([k, v]) => `<span role="listitem"><button class="tag" data-k="${esc(k)}" aria-label="${esc(KINDS[k].name)}: ${esc(KINDS[k].word(v))}. Change or forget">`
      + `<span aria-hidden="true">${KINDS[k].icon}</span> ${esc(KINDS[k].word(v))}</button></span>`).join('')
      + (tell ? `<span role="listitem"><button class="tag tag-add">${esc(chipLabel)}</button></span>` : '');
    el.querySelectorAll('.tag[data-k]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const K = KINDS[b.dataset.k];
      if (K.sheet && tell) return tell.open(K.sheet, 'tag');
      openPick(b.dataset.k, b);
    });
    el.querySelector('.tag-add')?.addEventListener('click', e => { e.stopPropagation(); tell.openMenu('menu'); });
    el.hidden = !rows.length && !tell;
    if (!pick.hidden && !about[pick.dataset.k]) closePick();
  }
  function openPick(k, from) {
    const K = KINDS[k], now = visit.get(k);
    const on = id => (K.multi ? [].concat(now || []).includes(id) : id === now);
    opener = from;
    pick.dataset.k = k;
    pick.innerHTML = `<h3 id="tag-pick-title">${esc(K.title)}</h3>
      <div class="dial">${K.options().map(o => `<button data-id="${esc(o.id)}" class="${on(o.id) ? 'on' : ''}" aria-pressed="${on(o.id)}">${esc(o.label)}</button>`).join('')}</div>
      <p class="tag-acts"><button class="link" data-act="forget">Forget this</button><button class="ok" data-act="done">Done</button></p>`;
    pick.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
      K.pick(b.dataset.id);
      if (!K.multi) return closePick();
      const v = [].concat(visit.get(k) || []).includes(b.dataset.id);     // several: it stays open, the button shows the choice
      b.classList.toggle('on', v); b.setAttribute('aria-pressed', String(v));
    });
    pick.querySelector('[data-act=forget]').onclick = () => { visit.forget(k); closePick(); };
    pick.querySelector('[data-act=done]').onclick = () => closePick();
    // Above the tag, kept on screen
    const r = from.getBoundingClientRect();
    pick.hidden = false;
    const h = pick.offsetHeight, w = pick.offsetWidth;
    pick.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left))}px`;
    pick.style.top = `${Math.max(8, r.top - h - 8 < 60 ? Math.min(innerHeight - h - 8, r.bottom + 8) : r.top - h - 8)}px`;
    (pick.querySelector('.on') || pick.querySelector('button')).focus();
  }
  function closePick() {
    if (pick.hidden) return;
    pick.hidden = true;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    else el.closest('.chatwin')?.querySelector('.cw-more')?.focus({ preventScroll: true });
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && !pick.hidden) { e.stopPropagation(); closePick(); } }, true);
  document.addEventListener('pointerdown', e => { if (!pick.hidden && !pick.contains(e.target) && !e.target.closest('.tag')) closePick(); }, true);
  visit.subscribe(render);
  render();
  return { render, kinds: KINDS, openEnergy: () => { const b = el.querySelector('.tag[data-k="energy"]') || el.querySelector('.tag-add'); if (b) openPick('energy', b); } };
}
