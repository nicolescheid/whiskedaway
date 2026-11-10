// The contact form at the end of the front door's story (11 Nov 2026, for Nicole's demo). The top bar's envelope opens the door
// on it (/?door=1#contact). It posts to Nicole's existing contact Worker (C:\dev\nicolescheid-contact, nicolescheid.com/api/contact),
// which allows whiskedaway.com cross-origin and does the rest: an Origin check, a honeypot, 3 a minute per IP, a Turnstile check
// that fails closed, then Cloudflare Email Routing to her verified address. No address is in this page, so nothing to harvest.
// The person check is the Praxilogue Turnstile widget (its hostnames must include whiskedaway.com), loaded only when the form
// comes near the screen. If the visitor pass has already loaded Turnstile, that copy is used.

const ENDPOINT = 'https://nicolescheid.com/api/contact';
const SITEKEY = '0x4AAAAAAFxNOby5utiMYELC';   // the Praxilogue widget the contact Worker checks (public, not a secret)

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => reject(new Error('turnstile_unavailable'));
    document.head.appendChild(s);
  });
}

export function install() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const slot = form.querySelector('[data-contact-check]'), status = form.querySelector('.contact-status'), send = form.querySelector('button[type=submit]');
  let widget = null, token = '', loading = null;
  const say = (text, bad = false) => { status.textContent = text; status.classList.toggle('bad', bad); };

  const ready = () => {
    if (loading) return loading;
    loading = loadTurnstile().then(ts => {
      widget = ts.render(slot, {
        sitekey: SITEKEY, action: 'whiskedaway-contact', theme: 'light', size: 'flexible',
        callback: t => { token = t; },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; },
      });
      return ts;
    }).catch(() => { loading = null; say("The person check didn't load. Please reload the page and try again.", true); });
    return loading;
  };
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { near.disconnect(); ready(); } }, { rootMargin: '300px' });
    near.observe(form);
  }
  form.addEventListener('focusin', ready, { once: true });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim(), email = String(data.get('email') || '').trim(), message = String(data.get('message') || '').trim();
    if (!name || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Please add your name, a valid email, and a message.', true); return; }
    await ready();
    if (!token) { say('Please tick the person check above the Send button first.', true); return; }
    send.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body: data });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) {
        form.reset();
        say("Thank you. Your message is on its way, and you'll hear back by email.");
      } else {
        say(out.message || "That didn't send. Please try again in a minute.", true);
      }
    } catch {
      say("That didn't send. Please check your connection and try again.", true);
    } finally {
      send.disabled = false;
      token = '';
      try { if (widget != null) window.turnstile?.reset(widget); } catch { /* gone */ }
    }
  });
}
