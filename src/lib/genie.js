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
  const box = document.createElement('div');
  box.setAttribute('aria-live', 'polite');
  box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;';
  document.body.appendChild(box);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('turnstile_timeout')), 60000);
      let errors = 0;
      const id = turnstile.render(box, {
        sitekey: SITEKEY,
        action: ACTION,
        appearance: 'interaction-only',   // invisible unless the visitor needs to tick a box
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
