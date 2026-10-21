// The basket, its own sheet (Nicole, 22 Oct: the book and the basket are two places). Leaflets wait here until the visitor
// checks them out (checkout.js) and Gemma writes them into the book. A full-height sheet on phones, a single page over the
// dimmed room on desktop. Escape, ✕, the dim and back close it; focus returns to whatever opened it.
// To go from here to the book, closeThen() waits for this sheet's history step back first (the QA 9 race: a late step back
// would land on the book's own entry and close it again).

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesk = () => matchMedia('(min-width: 720px) and (min-height: 501px)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createBasketView({ basket, checkout, chip, lines = {}, track, bucket }) {
  const root = document.createElement('div');
  root.id = 'basket-sheet';
  root.className = 'book bs-sheet';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'basket-title');
  root.innerHTML = `<div class="bk-dim"></div>
    <div class="bk-box">
      <header class="bk-head"><h2 id="basket-title">${esc(lines.title || 'Your basket')}</h2>
        <button class="bk-close" aria-label="${esc(lines.close || 'Close the basket')}">✕</button></header>
      <section class="bk-page bs-page" tabindex="-1"></section>
    </div>`;
  document.body.appendChild(root);
  const page = root.querySelector('.bs-page');
  let pushed = null, opener = null;                               // pushed: this open's history token (a reload can leave an old entry's flag)
  const isOpen = () => !root.hidden;

  // The chip: "Your basket" with its count of leaflets
  const chipName = lines.chip_long || 'Your basket';
  chip.querySelector('.long').textContent = chipName;
  chip.querySelector('.short').textContent = lines.chip_short || 'Basket';
  function chipCount() {
    const n = basket.count, badge = chip.querySelector('.badge');
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = !n;
    chip.setAttribute('aria-label', `${chipName}${n ? `, ${n} ${n === 1 ? 'leaflet' : 'leaflets'}` : ''}`);
  }

  const draw = () => { if (isOpen()) checkout.render(page, draw); };

  /** Open the checkout; `tick` an idea a centrepiece or the star chart just put in */
  function open({ from = 'chip', tick = null } = {}) {
    const was = isOpen();
    checkout.opened(tick);
    if (!was) {
      opener = document.activeElement;
      track?.('checkout_open', { from, basket_size: bucket(basket.count), remaining: String(checkout.left) });
    }
    root.hidden = false;
    root.classList.toggle('desk', isDesk());
    chip.setAttribute('aria-expanded', 'true');
    chip.classList.add('on');
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.basketInert = '1'; }
    draw();
    if (!was) {
      if (!pushed) { pushed = Math.random().toString(36).slice(2, 8); history.pushState({ ...(history.state || {}), basket: pushed }, ''); }
      if (!reduce()) root.querySelector('.bk-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      page.scrollTop = 0;
      (page.querySelector('input:not(:disabled)') || root.querySelector('.bk-close')).focus({ preventScroll: true });
    }
  }
  function close(viaBack = false, { refocus = true } = {}) {
    if (!isOpen()) return;
    root.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
    chip.classList.remove('on');
    for (const el of document.body.children) if (el.dataset.basketInert) { el.inert = false; delete el.dataset.basketInert; }
    if (pushed) { const mine = history.state?.basket === pushed; pushed = null; if (!viaBack && mine) history.back(); }
    if (refocus) (opener?.isConnected ? opener : chip).focus({ preventScroll: true });
  }
  /** Close, then run fn once this sheet's step back in history has gone (to open the book from here) */
  function closeThen(fn) {
    if (!isOpen()) return fn();
    let ran = false;
    const go = () => { if (!ran) { ran = true; fn(); } };
    addEventListener('popstate', () => setTimeout(go), { once: true });
    setTimeout(go, 400);
    close(false, { refocus: false });
  }
  addEventListener('popstate', () => { if (pushed && history.state?.basket !== pushed) { pushed = null; close(true); } });
  root.querySelector('.bk-close').onclick = () => close();
  root.querySelector('.bk-dim').onclick = () => close();
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button, input, a[href]')].filter(x => !x.disabled && x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  addEventListener('resize', () => { if (isOpen()) root.classList.toggle('desk', isDesk()); });
  basket.subscribe(() => { chipCount(); draw(); });
  chip.onclick = () => (isOpen() ? close() : open({ from: 'chip' }));
  chipCount();

  return { open, close, closeThen, refresh: draw, get isOpen() { return isOpen(); } };
}
