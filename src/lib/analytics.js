/**
 * Anonymous visit counting for WhiskedAway. docs/analytics-plan.md has the whole design.
 *
 * - Everything goes through track(name, params). Only events and parameters listed in
 *   analytics-events.js leave the page.
 * - Events go to our own genie Worker (POST /m), which forwards them to Google Analytics from
 *   Cloudflare's servers. Google never sees the visitor's IP, browser or a cookie.
 * - A visit is a random ID held in this module's memory. It's never stored, so it's gone on
 *   reload or when the tab closes, and nothing links one visit to the next.
 * - Nothing is sent if the browser asks not to be tracked (Do Not Track or Global Privacy
 *   Control), if this browser has opted out (?count-me=off), or off the live site
 *   (unless ?analytics=debug).
 *
 * Plain ES module that only imports its neighbours, so the React app and the explore world
 * can both use it.
 */

import { cleanEvent, visitSource } from './analytics-events.js';
import { getPass, peekPass, GENIE_URL } from './genie.js';

// Cloudflare Web Analytics site token for whiskedaway.com. Public, like the Turnstile sitekey.
const CF_BEACON_TOKEN = '9fad3ffefb1e4efb83f6e604457c3edf';
const OPT_OUT_KEY = 'wa-count-me-out';

const query = new URLSearchParams(location.search);

// ?count-me=off on Nicole's own browsers stops counting there; ?count-me=on starts it again
try {
  if (query.get('count-me') === 'off') localStorage.setItem(OPT_OUT_KEY, '1');
  if (query.get('count-me') === 'on') localStorage.removeItem(OPT_OUT_KEY);
} catch { /* storage blocked */ }

function optedOut() {
  try { return localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; }
}

const dontTrack = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
const live = /(^|\.)whiskedaway\.com$/.test(location.hostname);
const debug = query.get('analytics') === 'debug';
const enabled = !dontTrack && !optedOut() && (live || debug);

// Local testing can point at `wrangler dev`: ?analytics=debug&analytics-url=http://localhost:8787
const ENDPOINT = `${(!live && debug && query.get('analytics-url')) || GENIE_URL}/m`;

const visit = crypto.randomUUID();
const session = Math.floor(Date.now() / 1000);
// The 360° Inn is the home page; the old React Inn lives on at /archive/
const surface = location.pathname.startsWith('/archive') ? 'archive' : 'explore';
const device = matchMedia('(pointer: coarse)').matches || innerWidth < 768 ? 'mobile' : 'desktop';

let queue = [];
let timer = null;
let lastAt = performance.now();
let lastPass = null;
let lastPassAt = 0;
// A pass lasts 30 minutes. An older copy would be quietly dropped by the Worker, so treat it as none
// (a pass the Inn already fetched for the navigator counts too: it sits in sessionStorage, so no waiting)
const currentPass = () => (Date.now() - lastPassAt < 28 * 60 * 1000 ? lastPass : null) || peekPass();

/** Count one thing that happened. Unknown events and parameters are dropped. */
export function track(name, params = {}) {
  if (!enabled) return;
  const event = cleanEvent(name, params);
  if (!event) {
    if (debug) console.warn('[analytics] not on the list:', name);
    return;
  }
  const now = performance.now();
  event.ms = Math.max(1, Math.min(60000, Math.round(now - lastAt)));   // engagement time since the last event
  lastAt = now;
  queue.push(event);
  if (debug) console.info('[analytics]', event.name, event.params);
  clearTimeout(timer);
  timer = queue.length >= 10 ? (flush(), null) : setTimeout(flush, 4000);
}

// Where the visit came from: a coarse bucket, not the referrer. Goes with every batch
const src = visitSource(document.referrer, location.search, 'whiskedaway.com');
const payload = (events, pass) => {
  // The same coarse bucket goes with every batch, so every event of the visit carries it (a visit's later events used to have none)
  return JSON.stringify({ pass, visit, session, surface, device, debug, ...(src ? { src } : {}), events });
};

// text/plain keeps it a simple request: no CORS preflight, and sendBeacon can send it too
// Counting only works with a visitor pass. To see how many visits never get one, the page sends a tiny pass-less note
// (no visit ID, nothing else) that the Worker only writes to its log, never to Google: 'slow' (no pass after 8 s),
// 'failed' (the check gave up, with its code) or 'lost' (the tab was hidden with events still waiting and no pass)
const noted = {};
function note(state, extra = {}) {
  if (noted[state]) return;
  noted[state] = true;
  try { navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify({ ping: { state, ...extra }, surface, device })], { type: 'text/plain' })); } catch { /* ignore */ }
}
// Ask for the pass soon after the page loads, not when the first batch is due: a visitor who stays 10 s at the door
// should already have one. (The Inn asks too, once its first room is up; they share one request.)
if (enabled) {
  const t0 = performance.now();
  setTimeout(async () => {
    const slow = setTimeout(() => note('slow'), 8000);
    const p = await getPass().catch(() => null);
    clearTimeout(slow);
    if (p) {
      lastPass = p; lastPassAt = Date.now();
      const s = (performance.now() - t0) / 1000;
      track('pass_ready', { load_ms: s < 2 ? 'under-2s' : s < 5 ? '2-5s' : s < 10 ? '5-10s' : 'over-10s' });
    } else {
      let why = '';
      try { why = sessionStorage.getItem('wa-genie-error') || ''; } catch { /* ignore */ }
      note('failed', { why: /^[a-z0-9_]{1,40}$/i.test(why) ? why : 'unknown' });
    }
  }, 1000);
}

let sending = false;
async function flush() {
  clearTimeout(timer);
  if (!queue.length || sending) return;
  // The Worker only counts visitors with a pass. Don't wait on a slow Turnstile check for long:
  // keep the events and try again later (debug mode sends without one, for local testing)
  sending = true;
  const pass = await Promise.race([getPass().catch(() => null), new Promise(r => setTimeout(() => r(null), 8000))]);
  sending = false;
  if (pass) { lastPass = pass; lastPassAt = Date.now(); }
  if (!currentPass() && !debug) {
    queue = queue.slice(-50);
    timer = setTimeout(flush, 15000);
    return;
  }
  const events = queue.splice(0, 25);
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: payload(events, currentPass()), keepalive: true })
    .catch(() => { /* counting never gets in the way */ });
  if (queue.length) flush();
}

// The last few events go when the tab is hidden or closed
if (enabled) {
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !queue.length) return;
    if (!currentPass() && !debug) { note('lost', { queued: String(Math.min(queue.length, 25)) }); return; }   // no fresh pass: keep the events, in case the visitor comes back
    clearTimeout(timer);
    navigator.sendBeacon(ENDPOINT, new Blob([payload(queue.splice(0, 25), currentPass())], { type: 'text/plain' }));
  });
}

// Cloudflare Web Analytics: page views, referrers and load speed. No cookies, no visitor ID.
if (enabled && live && CF_BEACON_TOKEN) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: CF_BEACON_TOKEN });
  document.head.appendChild(s);
}
