# WhiskedAway measurement plan

18 Oct 2026. Agreed with Nicole the same day: visit grouping on, DNT/GPC honoured, wording as drafted, setup done (see Status at the end).

## The constraint

WhiskedAway reads a visitor's wander only inside the visit, to serve better content, and keeps nothing afterwards. Gemma's notebook says so: "It lives only in this tab, and nothing here is kept after you leave."

Measurement has to fit inside that promise. So the rule for everything below:

- We count what happens to the site (rooms, hotspots, recipes, the navigator). We don't keep a record of a person.
- Nothing links one visit to the next. No cookie, no stored ID, no user-ID, no fingerprinting.
- Nothing about how someone feels or what the navigator guessed about them leaves the browser.
- No advertising anything: no Google Signals, no ads links, no remarketing, no data sharing with Google products.

## What's worth learning

These are the questions the data should answer. Anything that doesn't serve one of them isn't collected.

1. **Does exploring lead to a recipe?** Of visits to /explore, how many get a card served, how many open one, and after how many steps.
2. **Which rooms draw people in, and which do they leave from?** Room entries, and the last room before the visit ends.
3. **Which weathers and times of day do people choose?** Barometer and clock turns, and whether a change of weather leads to an open card.
4. **Does the AI navigator beat the local one?** Open rate and "Not this" rate for cards served by each. How often the AI fails and falls back, and why.
5. **Where do people get stuck?** Closed doors touched, fixed-tool stubs opened, visits that end with nothing served, visits that never touch a hotspot.
6. **Is the world fast enough?** Load time to the first room on real devices, and how often the full-resolution render is skipped.
7. **Where do visitors come from?** Referrers and countries, at the level Cloudflare already shows.

## Tools

Two tools, each doing what it's good at.

**Cloudflare Web Analytics** for traffic. It's free on this account, sets no cookies, stores no IP and builds no visitor ID. It gives page views, referrers, countries, devices and Core Web Vitals for both surfaces. It can't see anything inside /explore, because the explore world is a single page.

**GA4 (property 518221900), fed server-side** for the explore world's events. The browser never loads Google's tag. Instead:

1. The page sends a small JSON event to our own Worker, `whiskedaway-genie`, at a new `POST /m` route.
2. The Worker checks the visitor pass (the existing Turnstile bot guard), drops anything not on the allow-list, adds the country from Cloudflare, and forwards it to the GA4 Measurement Protocol.
3. Google gets the event from Cloudflare's servers. It never sees the visitor's IP address, browser, cookies or device.

Why not the normal gtag.js tag:

- gtag sets a `_ga` cookie that lasts two years and recognises returning visitors. That is a cross-visit profile, and it breaks the notebook's promise.
- Consent mode with cookieless pings doesn't help a site this size. Google only uses those pings for modelling once a property has enough consented traffic, so for us the data would never show up.
- gtag sends the visitor's IP, user agent and a lot of default signals to Google. The server-side route sends only what's on our list.

Why GA4 at all rather than only Cloudflare: GA4 gives funnels, explorations and the analytics-mcp reports we already use for the other sites. Workers Analytics Engine would keep everything in Cloudflare, but there's no report UI and the MCP can't read it. It stays an option if GA4 ever feels wrong.

## The visit

To answer question 1 the events of one visit have to be grouped. We do that with a random visit ID that lives only in a JavaScript variable on the page:

- It's made when the page loads and is gone when the tab closes or reloads. It's never written to a cookie, localStorage or sessionStorage.
- It is not the visitor pass ID. The pass is for the bot guard and stays separate.
- A reload or a trip from / to /explore starts a new visit. That slightly over-counts visits, which is a fair trade.

GA4 sees each visit as a new, one-off user. It can't tell that two visits came from the same person, because nothing says so.

**Nicole decides (1): visit grouping on or off.** With it off, every event is sent on its own and GA4 can only give totals and ratios (open rate per card served, rooms ranked by entries). Question 1 and most of question 5 then can't be answered. I recommend on.

## Event taxonomy

All events go through one function per surface, `track(name, params)`, which drops any name or parameter not listed here. Values are short IDs from the world files, never free text.

### Explore world (/explore)

| Event | When | Parameters |
|---|---|---|
| `explore_start` | The first room has rendered | `room`, `nav_mode` (`ai` or `local`), `load_ms` (bucketed: `under-2s`, `2-5s`, `5-10s`, `over-10s`), `full_res` (`yes` for 8K, `phone` for the 4096 phone tier, `no` for preview only) |
| `room_enter` | Walking into a room | `room`, `from_room`, `step` (bucketed) |
| `hotspot_touch` | Touching any hotspot | `room`, `object` (hotspot ID, e.g. `kettle`), `object_type` (`ambient`, `interactive`, `door`, `walk`, `weather`, `time`, `season`, `dial`, `submit`, `energy`) |
| `door_closed` | Touching a door that isn't open yet | `room`, `object` |
| `weather_change` | The barometer is turned | `room`, `weather` |
| `weather_guess` | The Inn opens in the visitor's local weather (docs/local-weather.md), or they confirm Gemma's guess | `weather`, `outcome` (`shown`, `confirmed`) |
| `time_change` | The clock is pushed | `room`, `time_of_day` |
| `season_change` | The glasshouse seasons wheel | `season` |
| `dial_turn` | The hallway dial | `dial_choice` (a room ID or `star`) |
| `atom_served` | An idea's bubble has been in view for 2 seconds (or the visitor opened it sooner), once per idea per page. Not when the navigator picks it: ideas it picks and replaces unseen, or while the front door is up, don't count. Until 21 Oct 2026 it fired at the pick, about 11 a visit | `atom` (content ID), `atom_kind` (`ritual`, `recipe idea`, `technique`, `ingredient story`, `why it works`), `nav_mode`, `room`, `step` |
| `atom_open` | A card is opened: `from` is `highlight` ("Read ›") or `book` | `atom`, `atom_kind`, `nav_mode`, `room`, `step`, `from` |
| `atom_highlight` | An idea's bubble is opened into its highlight | `atom`, `atom_kind`, `nav_mode`, `room`, `step` |
| `atom_capture` | An idea is kept | `atom`, `atom_kind`, `nav_mode`, `room`, `step`, `method` (`button`, `swipe`, `book`), `book_size` |
| `atom_dismiss` | "Not this" (sent when the 5 s undo closes) | `atom`, `atom_kind`, `nav_mode`, `room`, `method`, `undone` (`yes`, `no`) |
| `nav_fallback` | The AI navigator failed and the local one answered | `reason`: `timeout`, `rate_limited` (429), `bot_check` (403), `upstream` (the Worker answered 5xx: the model or the Worker failed), `rejected` (other 4xx), `network` (the request never got through), `error` (anything else). Before 21 Oct 2026 `upstream`, `rejected` and `network` were all `error` |
| `map_open`, `notebook_open` | The panels are opened | `room` |
| `visit_forget` | "Forget this visit" | none |
| `leave_to_inn` | "Back to the inn" or a door to / | `room`, `step` |
| `erwina_seen` | Erwina, the Inn cat, appeared (there, not just her box or a trace) | none: no room, time or weather. She is only possible in the glasshouse (fair day), Flourish (rain) and the hallway (night), and only seen when the visitor holds still on her spot, so expect very few |
| `note_found` | An Inn note added to the book (the first touch of an object with a story) | `object` (its hotspot ID), `count` (how many found, 1 to 10) |

### Ideas, the book, Tell Gemma and cook mode (explore world)

Added after the first plan; counts only, never recipe text, diet answers, ingredients or list items.

| Event | When | Parameters |
|---|---|---|
| `chat_size` | Gemma's chat panel changes size | `panel_size` (`line`, `short`, `full`), `method` (`drag`, `tap`, `button`, `auto`) |
| `book_open` | The recipe book opens | `from` (`chip`, `card`, `notice_board`), `book_size` |
| `book_clear` | The book is cleared | `book_size` |
| `tell_open` | A Tell Gemma sheet opens | `kind`, `from` |
| `tell_set` | A Tell Gemma answer is set | `kind`, `from`, and for the multi-value kinds `count` (`0`, `1`, `2-3`, `4+`) and `use_up`. Single-choice kinds (`ANSWER_KINDS` in analytics-events.js) never send a count: it would be the answer |
| `mix_swap` | The Chiapothecary: Gemma suggested a swap | `outcome` (`accepted`, `declined`) |
| `recipe_full_asked` | The "full recipe" button, or cook mode, asked Gemma to write a recipe out (3 a visit) | `atom`, `room` |
| `recipe_full` | She wrote it out | `atom`, `room`, `remaining` (`0`, `1`, `2-3`) |
| `recipe_full_failed` | She couldn't | `atom`, `room`, `reason` (`timeout`, `bot_check`, `rate_limited`, `error`) |
| `cook_open` | Cook mode starts | `from` (`book`, or `loose` for a recipe not in the book) |
| `cook_done` | Cook mode finished | none |
| `timer_start`, `timer_done` | A cook-mode timer | none |
| `list_open`, `list_share` | The shopping list opened, shared or copied | none |
| `list_build` | A recipe put on the shopping list (22 Oct, multi-recipe list) | `from` (contents, recipe, list, cook, jars), `count` (recipes on it: 1, 2-3, 4+) |
| `list_export` | The list taken away; replaces `list_share` from 22 Oct | `kind` (copy, share, print). Never what is on the list |

`step` is how many trail events the visit has had so far, bucketed `1`, `2-3`, `4-7`, `8-15`, `16+`. It answers "after how many steps" without sending a timeline.

### The front door (/, from the front-door branch)

Since the front door (docs/front-door-spec.md), the 360° Inn is the home page and the React Inn is the archive at /archive/.

| Event | When | Parameters |
|---|---|---|
| `door_view` | The storybook picture is shown | none |
| `door_open` | The visitor clicks in | `film` (`full`, or `short` with reduced motion or Data Saver), `from` (`picture`, or `story`) |
| `welcome_close` | Gemma's welcome card is closed (first visit, or after ringing the bell) | none |
| `bell_ring` | The brass bell is rung | `room` |
| `story_view` | The story below the picture scrolled into view | none |
| `story_link` | "How it works" tapped | none |

### The React Inn (/archive/ since the front door; / before)

| Event | When | Parameters |
|---|---|---|
| `scene_view` | A kitchen scene is shown | `scene` (`inn-exterior`, `cuddlecore`, ...) |
| `recipe_request` | A kitchen's form is submitted | `scene` |
| `recipe_result` | The Worker answers | `scene`, `outcome` (`ok`, `rate_limited`, `bot_check`, `error`) |

The Inn's form contents (pantry items, dietary choices, cravings) are never sent.

### Where a visit came from (added 21 Oct 2026)

The Worker forwards events server-side, so Google sees no referrer and every visit used to show source "(not set)". The page now works out a coarse source itself and sends it once, with the first batch of events that actually goes out:

- `bucket`: `linkedin` (linkedin.com, lnkd.in, the LinkedIn app), `google`, `bing`, `other` (any other site) or `direct` (no referrer, or our own site). Computed from `document.referrer` on the page; the referrer itself, its path and its query never leave the browser.
- `utm_source` and `utm_campaign`, if the link has them, and only if they are short IDs (the same rule as every other value). Put `?utm_source=linkedin&utm_campaign=launch` on links in posts.

The Worker validates all of it again (`sourceParams` in analytics-events.js) and adds three event parameters to every event of that batch: `source`, `medium` and `campaign`. These are GA4's own names, so GA4 can read them as the session's attribution and Reports > Acquisition shows source/medium. Mapping: `linkedin` is `linkedin / social`, `google` and `bing` are `organic`, `other` is `referral`, `direct` is `(direct) / (none)`. A `utm_source` replaces the source, with medium `social` for `linkedin` and `campaign` otherwise. No new custom dimensions are needed. If that first batch fails to send, the visit has no source: a rare loss, not retried.

Check after deploy: GA4 Realtime or DebugView for a visit opened with `?utm_source=test&analytics=debug`, then Acquisition after a day. Google documents session attribution for the Measurement Protocol only loosely, so confirm it shows before trusting it.

### Parameters every event gets

Added in the Worker, not trusted from the page: `country` (from Cloudflare, two letters), `surface` (`explore` for the 360° Inn at / and /explore, `archive` for /archive/, and `inn` for the React Inn at / before the front door), `device` (`mobile` or `desktop`, from screen width, sent by the page).

### GA4 custom dimensions to register (event-scoped)

`room`, `from_room`, `object`, `object_type`, `weather`, `time_of_day`, `season`, `dial_choice`, `atom`, `atom_kind`, `nav_mode`, `reason`, `step`, `load_ms`, `full_res`, `scene`, `outcome`, `country`, `surface`, `device`, and `film` (added with the front door). Later additions, all registered: `kind`, `method`, `panel_size`, `book_size`, `from`, `count`, `remaining`, `undone`, `use_up`. `source`, `medium` and `campaign` are GA4's built-ins and need no registering. `explore_start` has carried `nav_mode` since 18 Oct.

## Deliberately not collected

| Not collected | Why |
|---|---|
| The trail as a sequence, or timestamps per event beyond GA's own | That is the wander itself. It lives in the tab, as promised. |
| The navigator's guess (`hypothesis`, cluster, confidence) | It's an inference about the person, not about the site. |
| Which energy candle was picked | It's how someone says they feel. We count that a candle was touched (`object_type: energy`), not which one. |
| Lingering (looking at something for a while) | It's close to gaze tracking. Touches are enough. |
| Anything typed (Gemma chat, the Inn's forms) | Free text can hold anything, including names and health details. |
| IP address, user agent, screen size beyond mobile/desktop | Not needed to answer any question above. |
| Any ID that survives the tab | It would recognise returning visitors. |
| The visitor pass ID | It's for the bot guard only. |
| Hemisphere or season guessed from location | Country is enough. |

## Consent

This is my reading, not legal advice.

- **NZ (Privacy Act 2020) and AU (Privacy Act 1988 and the APPs):** neither needs a cookie banner. Both expect you to say what you collect and why. With no identifier and no personal information collected, a plain note covers it. A non-commercial hobby site under AU$3m turnover is also outside most of the APPs.
- **EU and UK (GDPR and ePrivacy/PECR):** consent is needed for storing or reading anything on the visitor's device that isn't strictly necessary. This plan stores nothing on the device for analytics: the visit ID is in memory only, and the visitor pass in sessionStorage is part of the bot guard, which is strictly necessary. What's sent is anonymous counts with a random per-page ID and no IP. That fits legitimate interest, disclosed in the privacy note.
- Since the front door, the site keeps one thing on the device that isn't for counting: `wa-welcomed` in localStorage, so Gemma doesn't welcome someone twice. It's never sent anywhere, and the notebook line says so. The local-weather guess (docs/local-weather.md) uses Cloudflare's rough location on the server, rounded to about 50 km, and stores nothing on the device; only the resulting weather (`rain`, `fair`, ...) reaches GA4, in `weather_guess`.
- So **no banner**, as long as the design stays as above. If we ever add gtag.js or a stored ID, a banner becomes necessary for EU visitors.

**Do Not Track and Global Privacy Control:** if the browser sends either, the page sends nothing at all, to Cloudflare or GA4. That costs a small slice of data and keeps the promise simple: if your browser says don't track, we don't.

**Nicole decides (2): honour DNT/GPC by sending nothing.** I recommend yes.

## Bots and Nicole's own visits

- **Bots:** `/m` needs a valid visitor pass, the same Turnstile-backed pass the AI navigator uses. Scripts without a pass get dropped, uncounted. The existing per-IP and global rate limits apply too. Cloudflare Web Analytics does its own basic bot filtering.
- **Nicole:** opening `whiskedaway.com/explore/?count-me=off` once on each of her devices sets `wa-count-me-out` in that browser's localStorage, and the page then sends nothing. `?count-me=on` clears it. This is the one thing stored on a device, and only on the devices of someone who asked for it.
- **Localhost and branch previews** send nothing unless the URL has `?analytics=debug`, which also marks events as `debug_mode` so they show in GA4 DebugView instead of the reports.

## Privacy wording and credits

Notebook line, explore world:

> What I've noticed on this visit. It lives only in this tab, and nothing here is kept after you leave. The inn does count, anonymously, which rooms and recipes get visited, but never who.

New line in "Made with open things":

> **Counting visitors**: Cloudflare Web Analytics and Google Analytics, with no cookies and nothing that identifies you. If your browser asks not to be tracked, nothing is sent.

**Nicole decides (3): the wording.** These are drafts in her voice; she'll want to tune them. The React Inn has no credits or privacy text yet. I'd add the same line to its footer only if she wants one there.

## Setup Nicole does in GA4 and Cloudflare

The analytics-mcp can only read, so these are dashboard jobs.

**Nicole decides (4): do the GA4 setup below.** About ten minutes.

GA4, property `whiskedaway.com` (518221900):

1. Admin > Data streams. If there's no Web stream for `https://whiskedaway.com`, add one. Turn **Enhanced measurement off** (it only works with gtag anyway). Note the Measurement ID (`G-...`). It's public, fine to share.
2. In that stream, Measurement Protocol API secrets > Create, nickname `whiskedaway-genie`. The secret is private. Don't paste it in chat. Put it in the Worker with `npx wrangler secret put GA_API_SECRET --config worker/wrangler.toml`.
3. Admin > Data collection: Google Signals **off**. Granular location and device data **off**.
4. Admin > Data retention: event data **2 months**.
5. Admin > Account > Data sharing settings: everything **off**.
6. No Google Ads or other product links.
7. Admin > Custom definitions: register the 20 event-scoped dimensions above. (I'll give the exact list to paste.)
8. Property currency is CAD. Harmless, since there's no revenue, but NZD would be tidier.

Cloudflare: Web Analytics > Add a site > `whiskedaway.com`, choose the **JS snippet** option (not automatic injection, so the page can honour DNT/GPC and the opt-out). Copy the site token. It's public.

## Implementation notes

**Explore world.** A new module `blender/explore/analytics.js`, copied to `public/explore/explore/` by the existing build step. It exports `track(name, params)`. Calls are added at the points that already exist in `explore.html`: `record()` (touches, weather, time, season, dial, room, dismiss, open), `navigate()` (served, fallback), the first render, the panel toggles, "Forget this visit" and "Back to the inn". The module also loads the Cloudflare beacon. Events are batched and sent at most every few seconds, and the last batch goes with `navigator.sendBeacon` when the page is hidden. Sending uses `genieFetch` so it gets the visitor pass the same way the navigator does. With the AI navigator off (`?ai=0`), events are still sent with a pass.

**React Inn.** A new module `src/lib/analytics.js` with the same `track()` and the same rules, called from `SceneRouter` (scene views) and `useKitchenSubmit` (recipe request and result). The Cloudflare beacon is loaded from the same module.

**Worker.** A new `POST /m` route in `worker/whiskedaway-worker.js`: checks the pass and Origin, validates every event against the same allow-list (the server's copy is the one that counts), adds `country`, `surface` and `engagement_time_msec`, and posts to `https://www.google-analytics.com/mp/collect`. `client_id` and `session_id` both come from the page's visit ID. A new rate limit, `M_LIMIT`, 60 a minute per pass. If `GA_API_SECRET` isn't set, `/m` answers 204 and does nothing, so the code can ship before the GA setup is done.

**Headers.** No CSP exists yet, so nothing to change. If one is added later it needs `static.cloudflareinsights.com` and `cloudflareinsights.com`.

## Reports and explorations in GA4

Once there's traffic:

1. **Explore funnel** (Funnel exploration, open funnel): `explore_start` > `hotspot_touch` > `atom_served` > `atom_open`. Broken down by `nav_mode`. This is question 1 and question 4.
2. **Navigator comparison** (Free form): `atom_served`, `atom_open`, `atom_dismiss` counts by `nav_mode`, with open rate and dismiss rate as calculated metrics. Plus `nav_fallback` by `reason`.
3. **Rooms** (Free form): `room_enter` by `room`, and `from_room` > `room` as a matrix. Path exploration starting at `explore_start` shows the last room before leaving.
4. **Weather and time** (Free form): `weather_change` by `weather`, `time_change` by `time_of_day`, and `atom_open` by `weather` at the time.
5. **Stuck points** (Free form): `door_closed` by `object`, `hotspot_touch` where `object_type` is `interactive` or `submit` (the fixed-tool stubs), and the funnel's drop-off before `atom_served`.
6. **Content** (Free form): `atom_open` by `atom`, the recipes that actually get read.
7. **Speed**: `explore_start` by `load_ms` and `full_res`, by `device`.

With one visitor (Nicole) none of this means anything yet. The first useful check is a few weeks after the site is shared, and even then GA4's thresholds may hide small numbers.

## Known gaps

- A reload counts as a new visit.
- Visitors with DNT/GPC, ad blockers that block `cloudflareinsights.com`, or no visitor pass (Turnstile failed) aren't counted. Ad blockers rarely block our own Worker, so GA4 coverage should be better than a normal tag's.
- The React Inn keeps a behaviour profile in localStorage across visits (`src/engine/behaviorTracker.js`, `storageManager.js`). It never leaves the device and analytics doesn't touch it, but it's at odds with the notebook's promise in spirit. Worth a separate look.

## Status (18 Oct 2026)

Built on the `analytics` branch:

- `src/lib/analytics-events.js`: the allow-list, imported by the browser and the Worker.
- `src/lib/analytics.js`: `track()`, the visit ID, DNT/GPC and opt-out checks, batching, the Cloudflare beacon. Shared by both surfaces (the explore build copies it beside `genie.js`).
- `blender/explore.html`: calls at each event point, the notebook line and the credits line.
- `src/kitchens/SceneRouter.jsx`, `useKitchenSubmit.js`: the Inn's three events.
- `worker/whiskedaway-worker.js`: `POST /m`. `worker/wrangler.toml`: `GA_MEASUREMENT_ID` and the `MEASURE_LIMIT` rate limit.

If the visitor pass isn't ready within 8 seconds, events stay queued and the page tries again 15 seconds later. The Worker only counts visitors with a pass.

Setup done:

- GA4 web stream `G-PBDF79MT72` (stream URL says www.whiskedaway.com, which doesn't matter for the Measurement Protocol). Enhanced measurement off. Google Signals off. Granular location and device data off. Ads personalisation off in every region. Event and user data retention 2 months. Account data sharing all off. No Google Ads links.
- Measurement Protocol secret `whiskedaway-genie` created and stored as the Worker secret `GA_API_SECRET`.
- Cloudflare Web Analytics site for whiskedaway.com (JS snippet), token in `analytics.js`.

Tested locally (dist preview on 4177 against `wrangler dev` on 8797, `?analytics=debug`): every explore event and `scene_view` reached `/m` with only allow-listed parameters, the energy candle went as `object_type: energy` only, and Google's Measurement Protocol validator accepted the payload. Not tested locally: the real forward to GA4 (the secret only exists on the deployed Worker) and the visitor pass (Turnstile doesn't issue passes to localhost:4177). Both are on the post-deploy checklist.

## Status (21 Oct 2026): first traffic read fixes

**GA4 sees about one visit in four.** Cloudflare Web Analytics counted 139, 22 and about 6 visits on 19, 20 and 21 Oct; GA4 saw 27, 9 and 4. Cloudflare doesn't need the visitor pass, GA4 events do. A visit is lost when:

1. the pass isn't ready before the visitor leaves. Turnstile was only started when the first batch was due (4 s after the first event), then waited up to 8 s. A visitor who left the front door within about 10 s sent nothing;
2. the tab was hidden with events queued and the pass sat in sessionStorage (fetched by the Inn for the navigator) but not in analytics.js, so the last-batch beacon was skipped;
3. Turnstile fails or is blocked (in-app browsers such as LinkedIn's are the suspect), or the visitor has DNT/GPC on or has opted out (those send nothing, on purpose).

Changes: the pass is requested 1 s after load; a pass already in sessionStorage counts for the beacon; and a new `pass_ready` event (`load_ms`: seconds since load, bucketed) records how long the pass took for the visits that got one. For the visits that don't, the page sends a tiny pass-less note with no visit ID: `slow` (no pass after 8 s), `failed` (the check gave up, with its code, e.g. `turnstile_error_300030`, `turnstile_timeout`, `session_403`) or `lost` (hidden with events waiting and no pass). The Worker writes these to its log only, never to Google, as `{"measure":"pass","state":...,"device":...,"country":...}`; `wrangler.toml` now turns Worker observability on so they can be read (dashboard > Workers > whiskedaway-genie > Observability, filter `measure`). Compare the counts of `failed` and `lost` with the gap. The `/session` route already logs `session_rejected` with Turnstile's error codes. Opt-outs are unchanged: nothing, not even a note, is sent with `?count-me=off`, DNT or GPC. Until this is read, treat GA4 figures as describing the visits that stayed, and use Cloudflare for the true count of arrivals.

The first traffic read (about 40 visits, 19 to 21 Oct) found tagging gaps, fixed on the `analytics-fixes` branch:

- **Sources:** see "Where a visit came from". Needs the Worker deployed (`npm run deploy:api`) as well as the site.
- **`erwina_seen`, zero events:** the call was added to the code on 20 Oct (21:02 NZ) but the event only joined the allow-list at 22:11, and the Worker is only as new as its last `deploy:api`. Both ends drop events that aren't on the list, silently. The code path is wired correctly. The spots are rare (see the table) and only 3 visits entered the glasshouse in the period, so zero may also be real. `test/analytics.test.mjs` now fails `npm run check` if any `track('...')` call names an event that isn't on the list.
- **`atom_served`:** now means "was in view" (see the table).
- **Write-out and cook mode:** the events already existed (`recipe_full`, `recipe_full_failed`, `cook_open`, `cook_done`) and nobody had reached them in the period (3 visits opened a card). Added the missing `recipe_full_asked`.
- **`nav_fallback`:** `reason` is finer (see the table).

**New events or parameters need two deploys:** the site (the browser copy of the list) and `npm run deploy:api` (the Worker's copy). Until both are live the event is dropped.
