# The Inn's code map

Which file does what, which role owns it, and where a new feature goes. The PM points every brief at this page.
Written 23 Oct 2026 by the Inn architecture session (code-health-plan.md steps 1, 2 and 4); updated 24 Oct for step 3, the
split of `blender/explore.html` into feature modules.

## The three rules

1. **No new feature logic in `blender/explore.html`.** It is the bootstrap: the markup, the styles that belong to the page,
   the data loads and the wiring that hands each module what it needs. A new feature is a module in `blender/explore/`,
   owned by one role, and explore.html gets at most a few lines to start it.
2. **Every sheet, dialog or overlay is a layer.** Show your element, then call `layers.open({ el, name, close })`. When it has
   hidden itself, call `layers.closed(handle)`. Don't push history, set `inert`, listen for Escape or popstate, trap Tab or
   restore focus yourself: `explore/layers.js` does all of that. To open something after closing something else, use
   `layers.afterBack(fn)`. To open something once nothing is open, use `layers.whenFree(fn)`. A layer over a live room (the
   first-visit tour, a popover) is `modal: false`.
3. **Every new layer gets a row in the sheet contract** (`scripts/sheet-contract.mjs`, `SHEETS`, or a journey). `npm run check`
   then opens it from its real opener and closes it every way it offers: Done, ✕, Escape and Back. A known failure goes in
   `EXPECTED` with a note, and comes off again when it's fixed.

Also: **any change to the Inn prompt bumps `PROMPT_VERSION` in `worker/writeout-cache.js` in the same commit.** That covers
INN_CONSTITUTION, the inn-idea lines of buildUserMessage, `worker/inn-extras.js` and the recipe model. Without the bump, the
write-out cache serves the old wording for up to 30 days.

## Who owns what

| Role | Files |
|---|---|
| Ideas build (main coder) | ideas.js, idea-pick.js, basket.js, basket-view.js, checkout.js, book.js, book-view.js, writeout.js, list.js, cook.js, kitchen.js, chia-mix.js, tell.js, tags.js, checkin.js, checkin-controls.js, navigator.js, theme.js, shopwords.js, serving.js, basket-glue.js, tell-glue.js, chia-glue.js, centrepieces.js, theme-glue.js, how-you-like-it.js, feels.js |
| Inn architecture / whoever holds the bootstrap | explore.html (bootstrap only), layers.js, touch.js, rooms.js, panorama.js, chat-glue.js, panels.js, inn-map.js, inn-dialogs.js, candles.js, arrival.js, scripts/check.mjs, scripts/sheet-contract.mjs |
| Phones / mobile lead | chat.js, edge-hints.js, tilt.js, swipe.js, data-budget.js |
| Sound | sound.js |
| Front door / homepage story | front-door.js, the door markup and story in explore.html (copy is content's) |
| Erwina | erwina.js |
| Sweet Spells, star chart | sweet-spells.js, star-chart.js, sweet-glue.js |
| Content editor (data only) | `*-world.json`, gemma-lines.json, inn-map.json (its words; art keeps its shapes), notes.js's lines (in gemma-lines.json) |
| Art (data and renders only) | `out/*_hotspots.json`, renders, `blender/*_build.py` |
| Worker | worker/whiskedaway-worker.js, worker/inn-extras.js, worker/writeout-cache.js |

Data-only work (world JSON, gemma-lines.json, renders, hotspots) never needs a code owner's sign-off, and nobody reformats those
files.

## explore.html and its modules (after step 3)

explore.html's module script is now only the bootstrap: the data loads (the six worlds, their hotspots, gemma-lines.json),
the merged `world`, the ROOMS table, the visit's `state` and `store`, `showRoomInUrl`, the keep-the-answer policy
(`EVERY_WAY_KEEPS`), the test hooks (`window.__explore`) and the start-up calls. It builds one shared object, `inn`, puts
those on it, then calls each module's `install(inn)` in turn.

**How a module works.** `export function install(inn) { ... }`. It adds what others need to `inn` (`inn.say = say`, or
`Object.assign(inn, { ... })` for its functions) and reads everything else from `inn` **when it's called**:
`inn.say(...)`, `inn.state.room`. Modules never import each other, so there are no cycles. A module imports its own
pieces from `explore/*.js` directly (`import { createTell } from './tell.js'`); the `../src/lib` helpers (track,
genieFetch, getPass, GENIE_URL, stepBucket) come through `inn`, because build-explore.mjs only rewrites those paths in
explore.html. A value several modules reassign is a field of `inn` (`inn.spots`, `inn.hotspots`, `inn.casting`,
`inn.castFor`, `inn.erwina`, `inn.hasLooked`, `inn.drag`, `inn.lastMove`, `inn.seasonGuess`).

**Install order matters only for what a module does at load** (its `create*()` calls, which also fix the order sheets are
added to the page). Today's order: touch, rooms, panorama, chat-glue, serving, basket-glue, chia-glue, sweet-glue,
centrepieces, tell-glue, how-you-like-it, theme-glue, panels, inn-map, inn-dialogs, candles, arrival. A new module goes after the ones whose
values it reads at load.

| Module | What it holds |
|---|---|
| `touch.js` | `touch(id)`: what every tap does (intro, trail, count, Inn note), then a table of handlers. Each feature registers its own with `inn.onTouch(order, when, run)`; the order numbers are listed at the top of touch.js |
| `rooms.js` | time of day, season and hemisphere, navTrail, the trail (record, lingering, countAtom), goRoom, introduce, setRoomText, wanderRoom (where the wander points); door taps |
| `panorama.js` | the renderer and texture cache, showWeather, crossFade, the theme colour, the clocks, the hotspots, render, resize, looking around (drag, keys, wheel, lookTo), Erwina's wiring |
| `chat-glue.js` | say, chatLine, setChips, CHIP_ACTS, typing, chatUI, the sound chip |
| `serving.js` | the navigator's timing (scheduleNavigate, navigate, applyReveal), L, pickLine, momentOf, innNoteLine, steer, the filters (dietClash, kitchenOk, the away rule, headline), serve, keepIdea, `ideas = createIdeas` |
| `basket-glue.js` | write-outs (recipeFetch, unitsNow, swapsFor, writer), intoBook, checkout, basketView, cook, shopList, bookView |
| `chia-glue.js` | chia (the Mix), CHIA_TOOLS, chiaActions; drawer and tool taps |
| `sweet-glue.js` | sweet (its sheets), SWEET_TOOLS, sweetSwapHtml; tool taps |
| `centrepieces.js` | roomIdeas, bestHere, cast, the star chart's fortune, canServe, onCard, showIdea, ideaPage, whenFree; star chart and cast taps |
| `tell-glue.js` | setAnswer, checkedIn, kitchenSaid, acknowledge, entryFact, maybeOfferTell, emptyRoomLine, mapDefault, shopWords, `tell = createTell`, the tags; kitchen and Tell Gemma taps |
| `theme-glue.js` | themeNow, renderTheme, the theme caption, the notice board (and its tap) |
| `panels.js` | fitDock, the notebook (renderTold, renderNotes), fromBook, the bar's Front door, Forget, what follows a change to the visit store |
| `inn-map.js` | the Inn map (24 Oct): the bar's Map button opens a plan of the Inn drawn from `inn-map.json` (content and art edit it); tap a room to walk there, ✦ Where my wander points, and "In this room" (every hotspot here, for keyboards and screen readers). A layer |
| `how-you-like-it.js` | Cuddlecore's "How you like it" tray, the little cage and the bell jar (24 Oct): one layer with a view per object; the store keys `feels` and `keepingOff`; `inn.likeClash` (the filter: the bell jar, then the cage), `inn.loosenFeels` (a room left with only caged ideas), `inn.howYouLike.payload()` for write-outs; the cage's overlay (`inn.spriteFrom`). The bell jar is behind `MEDICINE_FOODS` (off until a pharmacist or dietitian has checked it; `?medicine-foods=1` on a local build). Its data and rules are `feels.js` (unit-tested) |
| `inn-dialogs.js` | showDialog, hideDialog, openTool, the barometer, clock and seasons wheel (and their taps) |
| `candles.js` | spriteFrom (on `inn`, for any overlay drawn into the room), the candle's flame and glow, showCandle, chooseEnergy |
| `arrival.js` | arrive (the foyer's check-in offer, the weather question), checkinPill, endCheckinOffer, faceDesk, settle |

## Where new features go (the queue, 23 Oct)

- **The Inn map**: live (24 Oct), `explore/inn-map.js` and `inn-map.json`. The teleporter dials are gone; the garden is on
  the plan as Coming soon and lights up once its ROOMS entry exists.
- **Cuddlecore's "How you like it" tray, cage and bell jar**: built 24 Oct, `explore/how-you-like-it.js` and `feels.js`, on placeholder hotspots until art renders them (docs/art-brief-cuddlecore-tray.md). The cage's
  overlay is drawn like the candle flames (`inn.spriteFrom`, from candles.js). Its filter goes in serving.js next to dietClash and
  kitchenOk, and the cage always wins.
- **The Food map adventure dial**: part of inn-map.js or its own sheet. Its filter goes in serving.js.
- **The first-visit tour**: `explore/tour.js`, a `modal: false` layer, started from arrival.js. Skip and Escape end it.
- **The garden**: a world JSON plus renders. ROOMS picks it up in the bootstrap; a new kind of object registers its tap with
  `inn.onTouch`.

Each one: its own module with `install(inn)`, a layer (rule 2), a contract row (rule 3), and a line in the table above.

## Tests

- `npm run check`: build, unit tests (test/*.test.mjs), every room at five sizes by day and night, the front door, the star
  dial, Gemma in every room, then the sheet contract at 375x812 and 1280x800. About 6 minutes.
- `npm run check -- --no-build --sheets-only`: just the sheet contract. `SHEETS_ONLY=pantry,book` runs some sheets only;
  `SHEETS_VERBOSE=1` logs each case.
- Test hooks: hotspots carry `data-spot`; `window.__explore` has `world`, `spot(id)`, `goRoom`, `lookTo`, `chatUI`, `book`;
  `window.__layers` is the stack; `window.__recipeFetch` answers write-outs locally.
