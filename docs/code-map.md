# The Inn's code map

Which file does what, which role owns it, and where a new feature goes. The PM points every brief at this page.
Written 23 Oct 2026 by the Inn architecture session (code-health-plan.md steps 1, 2 and 4). Step 3, the split of
`blender/explore.html`, is planned below. Update the "Lives in" column as each block moves.

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
| Ideas build (main coder) | ideas.js, idea-pick.js, basket.js, basket-view.js, checkout.js, book.js, book-view.js, writeout.js, list.js, cook.js, kitchen.js, chia-mix.js, tell.js, tags.js, checkin.js, checkin-controls.js, navigator.js, theme.js, shopwords.js; after the split serving.js, tell-glue.js, basket-glue.js |
| Inn architecture / whoever holds the bootstrap | explore.html (bootstrap only), layers.js, scripts/check.mjs, scripts/sheet-contract.mjs; after the split touch.js, rooms.js |
| Phones / mobile lead | chat.js, edge-hints.js, tilt.js, swipe.js, data-budget.js |
| Sound | sound.js |
| Front door / homepage story | front-door.js, the door markup and story in explore.html (copy is content's) |
| Erwina | erwina.js |
| Sweet Spells, star chart | sweet-spells.js, star-chart.js |
| Content editor (data only) | `*-world.json`, gemma-lines.json, notes.js's lines (in gemma-lines.json) |
| Art (data and renders only) | `out/*_hotspots.json`, renders, `blender/*_build.py` |
| Worker | worker/whiskedaway-worker.js, worker/inn-extras.js, worker/writeout-cache.js |

Data-only work (world JSON, gemma-lines.json, renders, hotspots) never needs a code owner's sign-off, and nobody reformats those
files.

## explore.html today, and where each block goes (step 3)

The module script in explore.html is one closure: every block reads `state`, `world`, `LINES`, `say`, `record` and friends
directly. The split keeps that working with one shared object. explore.html builds `inn = { state, world, LINES, visit, book,
basket, ... }` and each new module exports `install(inn)`, which adds its functions to `inn` and reads the others from `inn`
when it is called, not when it is loaded. That avoids import cycles, and it changes no behaviour.

| Block (explore.html today) | Goes to | Notes |
|---|---|---|
| Rooms table (ROOMS from the six worlds), state load/save, showRoomInUrl | bootstrap (stays) | the data every module needs |
| Time of day, season and hemisphere, navTrail | `rooms.js` | deviceTime, seasonNow, askHemisphere |
| Panorama: renderer, texture cache, showWeather, crossFade, theme colour | `rooms.js` | three.js setup could stay in the bootstrap if simpler |
| The clocks (makeClock, setHands, showClock) | `rooms.js` | |
| Hotspots (buildHotspots, render, resize, drag, keyboard look, lookTo) | `rooms.js` | |
| Trail, lingering, counting (record, countAtom) | `rooms.js` or bootstrap | everyone calls record() |
| `touch(id)`: the long if/else by object type | `touch.js` | a table `{ type or tool → handler }`; each feature registers its own handler |
| goRoom, introduce, setRoomText, the hallway dial | `rooms.js` | |
| Navigator: scheduleNavigate, navigate, applyReveal | `serving.js` | |
| Gemma's chat glue (chatLine, setChips, CHIP_ACTS, say, typing) | bootstrap, or `chat-glue.js` | used by everything |
| Ideas: L lines, pickLine, momentOf, innNoteLine, steer, dietClash, kitchenOk, serve, canServe, showIdea, keepIdea, ideas = createIdeas | `serving.js` | the filters (dietary, kitchen, away rule, headline) live together here |
| Write-outs: recipeFetch, unitsNow, swapsFor, writer = createWriteOut, intoBook | `basket-glue.js` | |
| Checkout, basketView, cook, shopList, bookView | `basket-glue.js` | |
| Centrepieces: roomIdeas, bestHere, cast, CAST_LINES | `serving.js` | |
| Star chart glue (fortune) | `serving.js` (or sweet-spells' own glue) | |
| Chiapothecary glue (chia, CHIA_TOOLS, chiaActions) | `basket-glue.js` or its own `chia-glue.js` | |
| Sweet Spells glue (sweet, SWEET_TOOLS, sweetSwapHtml) | `serving.js` | |
| Tell Gemma: setAnswer, checkedIn, kitchenSaid, acknowledge, entryFact, maybeOfferTell, emptyRoomLine, tell = createTell, tagsUI, TOLD lines | `tell-glue.js` | EVERY_WAY_KEEPS lives here |
| Theme caption, notice board | `serving.js` | |
| fitDock, Map panel (fillMap, togglePanel), notebook (renderTold, renderNotes), fromBook | bootstrap, or `rooms.js` | |
| Inn dialogs: showDialog/hideDialog, barometer, clock, seasons wheel | `rooms.js` | already layers |
| Energy candles (flame sprites, showCandle, chooseEnergy) | `rooms.js` | |
| Arrival: the weather question, the check-in offer, faceDesk, settle | `rooms.js` | the first-visit tour (tour.js) hooks in here |
| `window.__explore` test hooks, the start-up calls | bootstrap (stays) | |

Target: explore.html under about 600 lines. Most of that is markup, the door's story and the page's own CSS.

## Where new features go (the queue, 23 Oct)

- **The Inn map** (replaces the bar's Map list and the hallway "teleporter" hotspots): `explore/inn-map.js`, a layer. Its
  opener is the bar's Map chip. Rooms are read from the ROOMS table.
- **Cuddlecore's "How you like it" tray, cage and bell jar**: `explore/how-you-like-it.js` (a layer and its sheet). The cage's
  overlay is drawn like the candle flames (rooms.js has the sprite helper). Its filter goes in serving.js next to dietClash and
  kitchenOk, and the cage always wins.
- **The Food map adventure dial**: part of inn-map.js or its own sheet. Its filter goes in serving.js.
- **The first-visit tour**: `explore/tour.js`, a `modal: false` layer, started from arrival in rooms.js. Skip and Escape end it.
- **The garden**: a world JSON plus renders. ROOMS picks it up in the bootstrap, and touch.js routes its objects by type.

Each one: its own module, a layer (rule 2), a contract row (rule 3), and a line in the table above.

## Tests

- `npm run check`: build, unit tests (test/*.test.mjs), every room at five sizes by day and night, the front door, the star
  dial, Gemma in every room, then the sheet contract at 375x812 and 1280x800. About 6 minutes.
- `npm run check -- --no-build --sheets-only`: just the sheet contract. `SHEETS_ONLY=pantry,book` runs some sheets only;
  `SHEETS_VERBOSE=1` logs each case.
- Test hooks: hotspots carry `data-spot`; `window.__explore` has `world`, `spot(id)`, `goRoom`, `lookTo`, `chatUI`, `book`;
  `window.__layers` is the stack; `window.__recipeFetch` answers write-outs locally.
