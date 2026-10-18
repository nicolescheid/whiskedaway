// "What you've told Gemma" as tags (ux-journey-stage1.md, Inn rule 11; recipe-book-ux.md v4 §4b): one small tag per
// about-you value in the visit store (🕯 low · 🌱 vegetarian …), shown in the chat's Short and Full sizes on phones and in its
// header on desktop. Tap a tag to change or forget it from any room, with the same choices as the object that owns it.
// A tag appears only once a value is set. New keys: add a renderer to KINDS.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createTags({ el, visit, world, choose }) {
  // Each kind: its icon, its words for a value, the picker's options and how a pick is made
  const KINDS = {
    energy: {
      icon: '🕯', name: 'Energy', title: 'How much have you got in you today?',
      word: v => world.energies?.[v]?.label?.toLowerCase(),
      options: () => Object.entries(world.energies || {}).map(([id, e]) => ({ id, label: e.label })),
      pick: id => choose.energy(id),
    },
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
      + `<span aria-hidden="true">${KINDS[k].icon}</span> ${esc(KINDS[k].word(v))}</button></span>`).join('');
    el.querySelectorAll('.tag').forEach(b => b.onclick = e => { e.stopPropagation(); openPick(b.dataset.k, b); });
    el.hidden = !rows.length;
    if (!pick.hidden && !about[pick.dataset.k]) closePick();
  }
  function openPick(k, from) {
    const K = KINDS[k], now = visit.get(k);
    opener = from;
    pick.dataset.k = k;
    pick.innerHTML = `<h3 id="tag-pick-title">${esc(K.title)}</h3>
      <div class="dial">${K.options().map(o => `<button data-id="${esc(o.id)}" class="${o.id === now ? 'on' : ''}" aria-pressed="${o.id === now}">${esc(o.label)}</button>`).join('')}</div>
      <p class="tag-acts"><button class="link" data-act="forget">Forget this</button><button class="ok" data-act="done">Done</button></p>`;
    pick.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { K.pick(b.dataset.id); closePick(); });
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
  return { render, kinds: KINDS };
}
