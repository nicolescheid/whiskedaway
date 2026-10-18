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

import { cleanEvent } from './analytics-events.js';
import { getPass, GENIE_URL } from './genie.js';

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
const surface = location.pathname.startsWith('/explore') ? 'explore' : 'inn';
const device = matchMedia('(pointer: coarse)').matches || innerWidth < 768 ? 'mobile' : 'desktop';

let queue = [];
let timer = null;
let lastAt = performance.now();
let lastPass = null;

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

const payload = (events, pass) => JSON.stringify({ pass, visit, session, surface, device, debug, events });

// text/plain keeps it a simple request: no CORS preflight, and sendBeacon can send it too
let sending = false;
async function flush() {
  clearTimeout(timer);
  if (!queue.length || sending) return;
  // The Worker only counts visitors with a pass. Don't wait on a slow Turnstile check for long:
  // keep the events and try again later (debug mode sends without one, for local testing)
  sending = true;
  const pass = await Promise.race([getPass().catch(() => null), new Promise(r => setTimeout(() => r(null), 8000))]);
  sending = false;
  if (pass) lastPass = pass;
  if (!lastPass && !debug) {
    queue = queue.slice(-50);
    timer = setTimeout(flush, 15000);
    return;
  }
  const events = queue.splice(0, 25);
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: payload(events, lastPass), keepalive: true })
    .catch(() => { /* counting never gets in the way */ });
  if (queue.length) flush();
}

// The last few events go when the tab is hidden or closed
if (enabled) {
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !queue.length) return;
    clearTimeout(timer);
    navigator.sendBeacon(ENDPOINT, new Blob([payload(queue.splice(0, 25), lastPass)], { type: 'text/plain' }));
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
