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
  nav_fallback: ['reason'],
  map_open: ['room'],
  notebook_open: ['room'],
  visit_forget: [],
  leave_to_inn: ['room', 'step'],         // "Front door": back out to the picture
  // Ideas and the recipe book (recipe-book-ux.md v4 §10). No recipe text, no diet answers
  atom_highlight: ['atom', 'atom_kind', 'nav_mode', 'room', 'step'],   // an idea's bubble opened into its highlight
  atom_capture: ['atom', 'atom_kind', 'nav_mode', 'room', 'step', 'method', 'book_size'],   // kept; method: button, swipe or book
  chat_size: ['panel_size', 'method'],                             // panel_size: line, short, full; method: drag, tap, button, auto
  book_open: ['from', 'book_size'],                                // from: chip, card, notice_board
  book_clear: ['book_size'],
  cook_open: ['from'],                                             // cook mode: from book|loose
  cook_done: [],
  timer_start: [],
  timer_done: [],
  list_open: [],                                                   // "What do I need?"
  list_share: [],
  tell_open: ['kind', 'from'],                                     // Tell Gemma: kind pantry|map|dietary; from object|tag|menu|book|offer
  tell_set: ['kind', 'count', 'use_up'],                           // count 0|1|2-3|4+; never the values (no ingredients, cuisines, country or diets)
  recipe_full: ['atom', 'room', 'remaining'],                      // Gemma wrote one out in full; remaining: 0, 1, 2-3
  recipe_full_failed: ['atom', 'room', 'reason'],                  // reason: timeout, bot_check, rate_limited, error

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

/** The event with only its allowed parameters, or null if the event isn't on the list. */
export function cleanEvent(name, params = {}) {
  const allowed = EVENTS[name];
  if (!allowed) return null;
  const out = {};
  for (const key of allowed) {
    const v = params[key];
    if (typeof v === 'string' && VALUE.test(v)) out[key] = v;
  }
  return { name, params: out };
}

/** Steps so far in the visit, in buckets, so "after how many steps" never becomes a timeline. */
export function stepBucket(n) {
  return n <= 1 ? '1' : n <= 3 ? '2-3' : n <= 7 ? '4-7' : n <= 15 ? '8-15' : '16+';
}
