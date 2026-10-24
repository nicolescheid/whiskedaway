/**
 * Every analytics event WhiskedAway can send, and the only parameters each may carry.
 * See docs/analytics-plan.md for why each one exists and what is deliberately left out.
 *
 * The browser (src/lib/analytics.js) and the genie Worker (POST /m) both import this file,
 * so this list is the one place to audit. Anything not here is dropped, in the browser and
 * again in the Worker.
 *
 * Plain ES module with no imports, like genie.js, so the explore world can load it too.
 */

export const EVENTS = {
  // The 360° Inn (/, was /explore)
  explore_start: ['room', 'nav_mode', 'load_ms', 'full_res'],
  room_enter: ['room', 'from_room', 'step'],
  hotspot_touch: ['room', 'object', 'object_type'],   // energy candles: object_type only, never which candle
  door_closed: ['room', 'object'],
  weather_change: ['room', 'weather'],
  weather_guess: ['weather', 'outcome'],   // the local-weather guess: shown, or confirmed by the visitor
  time_change: ['room', 'time_of_day'],
  season_change: ['season'],
  dial_turn: ['dial_choice'],
  atom_served: ['atom', 'atom_kind', 'nav_mode', 'room', 'step'],
  atom_open: ['atom', 'atom_kind', 'nav_mode', 'room', 'step', 'from'],     // from: highlight ("Read ›") or book
  atom_dismiss: ['atom', 'atom_kind', 'nav_mode', 'room', 'method', 'undone'],     // sent when the 5 s undo closes; undone: yes or no
  pass_ready: ['load_ms'],                 // the visitor pass arrived (bucketed seconds since the page loaded); visits that never get one send nothing, see docs/analytics-plan.md
  nav_fallback: ['reason'],                // reason: timeout, rate_limited, bot_check, upstream (the Worker answered 5xx), rejected (4xx), network, error
  map_open: ['room'],                     // the Inn map (the bar's Map button)
  inn_map_go: ['from_room', 'room'],      // a room tapped on the Inn map
  inn_map_star: ['room'],                 // the Inn map's ✦ Where my wander points
  // The first-visit tour (explore/tour.js): offered, started, and how it ended at which stop
  tour_offer: [],                         // Gemma offered it (a first visit, in the foyer after the door film)
  tour_start: ['from'],                   // from: arrival (the offer) or bell (Show me round)
  tour_end: ['how', 'stop'],              // how: finished, skip, escape, back, door, tap, walk, declined (stop 0); stop: 1-7, the stop it ended at
  notebook_open: ['room'],
  visit_forget: [],
  leave_to_inn: ['room', 'step'],         // "Front door": back out to the picture
  erwina_seen: [],                        // Erwina collapsed into view: counts sightings, never where or when
  note_found: ['object', 'count'],        // an Inn note added to the book: its object's id and how many are found (1-10), nothing else
  // Ideas and the recipe book (recipe-book-ux.md v4 §10). No recipe text, no diet answers
  atom_highlight: ['atom', 'atom_kind', 'nav_mode', 'room', 'step'],   // an idea's bubble opened into its highlight
  atom_capture: ['atom', 'atom_kind', 'nav_mode', 'room', 'step', 'method', 'book_size'],   // kept; method: button, swipe or book
  chat_size: ['panel_size', 'method'],                             // panel_size: line, short, full; method: drag, tap, button, auto
  book_open: ['from', 'book_size'],                                // from: chip, card, notice_board, basket, cast, mix
  book_clear: ['book_size'],
  // Cook mode and the shopping list (cook-mode-ux.md §4). Counts only: no recipe names, no ingredients, no list items
  cook_open: ['from'],                    // from: book, or loose (a recipe not in the book)
  cook_done: [],
  timer_start: [],
  timer_done: [],
  list_open: [],
  list_share: [],                         // (before 22 Oct) the share sheet or copy was used; what was shared never leaves the device through us
  list_build: ['from', 'count'],          // a recipe put on the shopping list; from: contents, recipe, list, cook, jars; count: recipes on it now 1|2-3|4+
  list_export: ['kind'],                  // the list taken away; kind: copy, share or print. Never what's on it
  tell_open: ['kind', 'from'],          // Tell Gemma: kind pantry|map|dietary|confidence|time|servings|energy|sweetness|sweetener|craving|occasion|mood|mix|kitchen|feels|cage|keeping-off|food-map; from object|tag|menu|book|offer|foyer|tour
  tell_set: ['kind', 'count', 'use_up', 'from'],   // count 0|1|2-3|4+ (pantry, map, dietary, sweetener, craving, feels: how many aren't "Either way", keeping-off: how many in the bell jar, food-map: how many pins and coloured-in countries); never the values (see ANSWER_KINDS). Dietary values (FODMAP included) never leave the page
  adventure_set: ['step'],              // the food map's adventure dial: step 1 (close to home) .. 5 (somewhere new), or unset. Never with the pins
  kitchen_pick: ['appliance'],           // Your kitchen: one per appliance newly picked on Done (stove, oven, microwave, kettle, air-fryer, bbq, food-processor, slow-cooker, none). Never with anything else
  mix_swap: ['outcome'],                 // the Chiapothecary: Gemma suggested a swap; outcome accepted or declined. Never the ingredients
  recipe_full_asked: ['atom', 'room'],                             // the "full recipe" button (or cook mode) asked Gemma to write one out
  recipe_full: ['atom', 'room', 'remaining'],                      // Gemma wrote one out in full; remaining: 0, 1, 2-3
  recipe_full_failed: ['atom', 'room', 'reason'],                  // reason: timeout, bot_check, rate_limited, error
  recipe_print: [],
  recipe_rewrite: ['kind', 'outcome', 'remaining'],                // a swap or other measurements on a written recipe; kind: swap, units; outcome: ok, failed; remaining: of 5 a day                                                // "Save as PDF / print" on a written recipe
  // The recipe basket (Stage 1, docs/basket-stage1-design.md): do visitors use up their 3 free write-outs a day?
  basket_add: ['from', 'basket_size'],                             // from: button, swipe, book, cast, star_chart
  checkout_open: ['from', 'basket_size', 'remaining'],             // from: chip, tab, cast, star_chart; remaining: today's write-outs left
  checkout_written: ['count', 'failed', 'remaining'],              // one checkout's "Write out": how many written, how many failed
  allowance_reached: ['from'],                                     // a write took today's left to 0; from: checkout, book, mix, cook

  // The front door at / (docs/front-door-spec.md)
  door_view: [],
  door_open: ['film', 'from'],            // film: full, or short (reduced motion or Data Saver); from: picture, or story
  welcome_close: [],
  bell_ring: ['room'],
  story_view: [],                         // the story below the picture scrolled into view
  story_link: [],                         // "How it works" tapped

  // The React Inn, now the archive (/archive/)
  scene_view: ['scene'],
  recipe_request: ['scene'],
  recipe_result: ['scene', 'outcome'],
};

// Short IDs from the world files and the code, never free text (a trailing + for open-ended buckets like 16+)
const VALUE = /^[a-z0-9][a-z0-9 ._-]{0,38}\+?$/i;

// Answers that are a single choice (the check-in, and Sweet Spells' and the Chiapothecary's): any count would be
// the answer itself (2 servings = "2-3"), so only the fact that one was set is ever sent
const ANSWER_KINDS = new Set(['confidence', 'time', 'servings', 'energy', 'sweetness', 'occasion', 'mood', 'mix']);

/** The event with only its allowed parameters, or null if the event isn't on the list. */
export function cleanEvent(name, params = {}) {
  const allowed = EVENTS[name];
  if (!allowed) return null;
  const out = {};
  for (const key of allowed) {
    const v = params[key];
    if (typeof v === 'string' && VALUE.test(v)) out[key] = v;
  }
  if (name === 'tell_set' && ANSWER_KINDS.has(out.kind)) { delete out.count; delete out.use_up; }
  return { name, params: out };
}

// Where a visit came from, as a coarse bucket (never the referrer itself), plus the link's own utm_source and
// utm_campaign when it has them. Sent once per visit, with its first events; the Worker checks it again.
const BUCKET_MEDIUM = { linkedin: 'social', google: 'organic', bing: 'organic', other: 'referral', direct: '(none)' };
const utm = v => { v = String(v ?? '').trim().toLowerCase(); return VALUE.test(v) ? v : null; };

/** The page's side: { bucket, utm_source?, utm_campaign? } from document.referrer, location.search and our own hostname. */
export function visitSource(referrer, search, ownHost) {
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { /* no referrer */ }
  const own = host === ownHost || host.endsWith(`.${ownHost}`);
  const bucket = !host || own ? 'direct'
    : /(^|\.)(linkedin\.com|lnkd\.in)$|^com\.linkedin\./.test(host) ? 'linkedin'      // the app sends android-app://com.linkedin.android
    : /(^|\.)google\.[a-z.]+$|^com\.google\./.test(host) ? 'google'
    : /(^|\.)bing\.com$/.test(host) ? 'bing' : 'other';
  const q = new URLSearchParams(search), out = { bucket };
  if (utm(q.get('utm_source'))) out.utm_source = utm(q.get('utm_source'));
  if (utm(q.get('utm_campaign'))) out.utm_campaign = utm(q.get('utm_campaign'));
  return out;
}

/** The Worker's side: GA4 event parameters (source, medium, campaign) from whatever the page sent, or null. */
export function sourceParams(src) {
  if (!src || typeof src !== 'object' || !Object.hasOwn(BUCKET_MEDIUM, src.bucket)) return null;
  const u = utm(src.utm_source);
  const source = u || (src.bucket === 'direct' ? '(direct)' : src.bucket);
  const medium = u ? (u === 'linkedin' ? 'social' : 'campaign') : BUCKET_MEDIUM[src.bucket];
  return { source, medium, ...(utm(src.utm_campaign) ? { campaign: utm(src.utm_campaign) } : {}) };
}

/** Steps so far in the visit, in buckets, so "after how many steps" never becomes a timeline. */
export function stepBucket(n) {
  return n <= 1 ? '1' : n <= 3 ? '2-3' : n <= 7 ? '4-7' : n <= 15 ? '8-15' : '16+';
}
