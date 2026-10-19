/**
 * The one way the browser talks to the whiskedaway-genie Worker.
 *
 * The Worker's paid routes want a visitor pass. To get one, the browser quietly solves a
 * Cloudflare Turnstile challenge (people almost never see it; it only appears when the
 * browser looks automated) and trades the token at /session for a signed 30-minute pass.
 * The pass is cached for this tab and sent with every call.
 *
 * Plain ES module with no imports, so the React app and the standalone explore prototype
 * can both use it.
 */

export const GENIE_URL = 'https://whiskedaway-genie.nicole-scheid.workers.dev';

// Public sitekey of the "WhiskedAway" Turnstile widget (not a secret).
const SITEKEY = (import.meta.env && import.meta.env.VITE_TURNSTILE_SITEKEY) || '0x4AAAAAAFYw2hms6uXM_iw8';
const ACTION = 'whiskedaway-session';
const PASS_KEY = 'wa-genie-pass';

let pending = null;

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

async function solveChallenge() {
  const turnstile = await loadTurnstile();
  // Turnstile stays invisible unless it needs the visitor to tick its box. In the Inn it then appears inside Gemma's chat,
  // as her message (brainstorm #6); elsewhere (the archive) on a small paper card, bottom-centre.
  // It's placed before Turnstile renders: moving its frame later would reload it
  const chat = document.getElementById('chatwin');
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  const note = document.createElement('p');
  const slot = document.createElement('div');
  // Turnstile's normal widget is 300x65; its compact one 150x140. In the chat on a phone the normal one is far shorter,
  // so the card may run a little wider than Gemma's bubble (over the ideas column, only while it shows) to fit it
  const wide = innerWidth - 32 >= 318;
  if (chat) {
    box.className = 'cw-check';
    box.style.cssText = 'display:none;flex-direction:column;align-items:flex-start;gap:4px;margin:0 0 4px;padding:6px 8px;border-radius:10px 10px 10px 2px;'
      + 'background:#fff;border:1px solid rgba(139,77,92,.25);box-shadow:0 6px 18px rgba(0,0,0,.2);pointer-events:auto;box-sizing:border-box;'
      + (wide ? 'width:318px;max-width:calc(100vw - 32px);position:relative;z-index:1;' : 'max-width:100%;');
    note.style.cssText = "margin:0;font:15px/1.35 'Crimson Pro',Georgia,serif;color:#2c2416;";
    note.textContent = 'One quick check that you’re a person, then I’ll carry on.';
    chat.insertBefore(box, chat.querySelector('.cw-body'));
  } else {
    box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;'
      + 'display:none;flex-direction:column;align-items:center;gap:8px;padding:10px 10px 8px;border-radius:14px;box-sizing:border-box;'
      + 'background:#f4efe4;border:1px solid rgba(139,77,92,.25);box-shadow:0 10px 30px rgba(0,0,0,.3);'
      + "font:500 13px Quicksand,system-ui,sans-serif;color:#2c2416;max-width:calc(100vw - 32px);";
    note.style.cssText = 'margin:0;text-align:center;';
    note.textContent = 'One quick check that you’re a person, then the Inn carries on.';
    document.body.appendChild(box);
  }
  box.append(note, slot);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('turnstile_timeout')), 60000);
      let errors = 0;
      const id = turnstile.render(slot, {
        sitekey: SITEKEY,
        action: ACTION,
        appearance: 'interaction-only',   // invisible unless the visitor needs to tick a box
        theme: 'light',
        size: (chat ? wide : innerWidth >= 420) ? 'normal' : 'compact',   // normal is 300x65, compact 150x140
        'before-interactive-callback': () => showWhenInside(box),
        'after-interactive-callback': () => { box.style.display = 'none'; },
        callback: token => { clearTimeout(timer); resolve(token); },
        // Turnstile retries by itself; only give up after repeated failures
        'error-callback': code => {
          if (++errors < 3) return;
          clearTimeout(timer);
          reject(new Error(`turnstile_error_${code}`));
        },
      });
      box.dataset.widget = id;
    });
  } finally {
    try { turnstile.remove(box.dataset.widget); } catch { /* already gone */ }
    box.remove();
  }
}

// The check never shows at the front door: it waits until the visitor has stepped inside. In the Inn it's already
// inside Gemma's chat, so it only needs showing; elsewhere (the archive) it sits bottom-centre
function showWhenInside(box) {
  const door = document.getElementById('front-door');
  if (door && !door.hidden) {
    const watch = new MutationObserver(() => {
      if (!door.hidden) return;
      watch.disconnect();
      showWhenInside(box);
    });
    watch.observe(door, { attributes: true, attributeFilter: ['hidden'] });
    return;
  }
  box.style.display = 'flex';
}

function cachedPass() {
  try {
    const p = JSON.parse(sessionStorage.getItem(PASS_KEY) || 'null');
    return p && p.until > Date.now() ? p.pass : null;
  } catch {
    return null;
  }
}

async function freshPass() {
  const token = await solveChallenge();
  const res = await fetch(`${GENIE_URL}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(`session_${res.status}`);
  const { pass, expires_in } = await res.json();
  try {
    sessionStorage.removeItem('wa-genie-error');
    sessionStorage.setItem(PASS_KEY, JSON.stringify({ pass, until: Date.now() + (expires_in - 60) * 1000 }));
  } catch { /* private mode: keep it in memory only */ }
  return pass;
}

/** A visitor pass, or null if one can't be had (the Worker then decides, per its rollout mode). */
export async function getPass({ renew = false } = {}) {
  if (!SITEKEY) return null;
  if (!renew) {
    const p = cachedPass();
    if (p) return p;
  }
  if (!pending) pending = freshPass().finally(() => { pending = null; });
  try {
    return await pending;
  } catch (err) {
    console.warn('WhiskedAway: could not get a visitor pass', err);
    try { sessionStorage.setItem('wa-genie-error', String(err.message || err)); } catch { /* ignore */ }
    return null;
  }
}

/** POST JSON to the genie Worker with a visitor pass. Returns the fetch Response. */
export async function genieFetch(path, body, { signal } = {}) {
  const send = pass => fetch(`${GENIE_URL}${path}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(pass ? { 'X-WA-Pass': pass } : {}) },
    body: JSON.stringify(body),
  });
  const pass = await getPass();
  const res = await send(pass);
  if (res.status !== 403) return res;
  // Pass expired or rejected: get a new one and try once more
  try { sessionStorage.removeItem(PASS_KEY); } catch { /* ignore */ }
  return send(await getPass({ renew: true }));
}
