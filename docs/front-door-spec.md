# The front door: the new whiskedaway.com home page

Spec, 18 October 2026. Branch `front-door`. Phase 1: plan only. Nothing gets built until Nicole has
answered the questions at the end.

## What Nicole decided (18 Oct)

1. whiskedaway.com/ opens on the storybook picture of the Inn held inside a balloon whisk
   (Part B of `docs/art-brief-inn.md`).
2. Clicking it plays a short film: the whisk swirls in toward the camera, sweeps into the front
   door, the door opens, and you arrive in the entrance hall of the 360° Inn.
3. On a first visit a welcome lightbox appears, then swirls up into a small brass handbell in the
   top-right corner. Ringing the bell brings the welcome and help back.
4. The 360° Inn becomes the main site. The old React Inn moves to whiskedaway.com/archive, so
   nothing is lost.

## What's already there

- **The art is back.** `art-inbox/inn-exterior/` has the picture (`whisk-inn-master.png`,
  1672 × 941, 16:9, late afternoon), a 240 KB webp for the site, a 1200 × 630 share image and a
  square crop. Its README already flags two gaps: it's soft as a full-width picture on big
  screens, and there's no portrait version.
- **Half the film exists.** The fly-through (`docs/flythrough-plan.md`) opens with the same
  move: a push-in on the whisk picture toward the front door, a dissolve, then shot 2, where the
  Blender front door swings open and the camera steps into the hall. The full-quality frames are
  rendered (1920 × 1080, rain, late afternoon) and sit in the `whiskedaway-hallway` worktree,
  `blender/out/flythrough/final/hall_0001.jpg` onward.
- **The landing spot exists.** The hallway has an entrance stop, `hall-entrance`, with the camera
  at (0, −1.3, 1.6) looking down the hall. Shot 2 passes that exact point at about frame 140,
  looking the same way. So the film can end on the frame that matches the live panorama and
  crossfade into it. No new panorama is needed.
- **Deep links already work in part.** `explore.html` takes `?room=<id>` (`cuddlecore`,
  `hall-entrance`, `hall-middle`, the glasshouse, Flourish and Sweet Spells stops).
- **Hosting.** `wrangler.jsonc` serves `dist/` as static assets in single-page-app mode. Workers
  static assets read a `_redirects` file, which covers the old links.

## Problems found

1. **The door colours don't match.** The storybook door is dusty berry. The Blender front door
   is dark brown wood. The film dissolves from one to the other, so the change shows.
   Fix: paint only the door's outside face berry in `hallway_build.py`, then re-render the film
   frames. The panoramas see the inside face, so they don't need re-rendering. (Plenty of real
   doors are painted outside and plain inside.)
2. **Phones.** The picture is 16:9 landscape. In portrait on a phone the whisk shrinks to a strip
   across the middle, or, cropped to fill the screen, the handle and most of the wires disappear.
   The film has the same problem.
3. **Big screens.** 1672 px wide is soft at full width on a large monitor.
4. **Gemma's arrival question only fires in Cuddlecore** (`arrive()` in `explore.html` checks
   `state.room === 'cuddlecore'`), and it points the visitor at the barometer, which is in the
   kitchen. Arriving in the entrance hall, she'd say nothing.
5. **The page's own name.** `explore.html` is titled "the Cuddlecore Kitchen", its top bar has
   "Back to the inn" (a link to `/`, the old React Inn), and the credits button says "Back to the
   kitchen". All of these change meaning once the 360° Inn is the home page.
6. **Analytics labels.** `src/lib/analytics.js` sets `surface` to `explore` for `/explore*` and
   `inn` for everything else, and the genie Worker's `/m` only accepts those two. After the move,
   "inn" would quietly mean the archive, and the front door would be counted as "inn".
7. **"First visit" means remembering something.** The notebook promises "nothing here is kept
   after you leave". Knowing that someone has been before needs one flag in `localStorage`.
8. **The archive under a sub-path.** The SPA fallback only ever serves the root `index.html`.
   If the old app lives at `/archive/`, a reload on `/archive/cuddlecore` would get the new home
   page instead, unless the build writes a copy of the archive's page at each of its routes.

## The proposal, piece by piece

### 1. The page and the URLs

The 360° Inn page itself moves to `/`. The front door is a layer over it: the picture, the film
and the welcome sit on top, while the Inn loads underneath. This keeps it all one page, so the
film can crossfade straight into the live panorama, Gemma's chat and the visitor pass carry
straight on, and the analytics counts one visit rather than two.

| URL | What it does |
|---|---|
| `/` | Front door (picture, film, welcome), then the Inn |
| `/?room=<id>` | Straight into that room. No front door, no film |
| `/explore/` and `/explore/?room=…` | 301 to `/` with the query kept, so shared links still work |
| `/archive/` | The old React Inn, as it is today |
| `/archive/cuddlecore` and the other old scenes | The old Inn's scenes |
| `/archive/original/…` | The older form-based site |
| `/cuddlecore`, `/flourish`, `/sweet-spells` | 301 to the same room in the 360° Inn (question 7) |
| `/cravings`, `/chiapothecary`, `/academy` | 301 to `/archive/<scene>` until those rooms exist |
| `/original/*` | 301 to `/archive/original/*` |

Reloading inside the same tab keeps you where you were (the visit state is in `sessionStorage`
already), so you don't walk through the door again.

Paths inside the Inn page (`explore/…json`, `out/…jpg`) are relative today. The build will
rewrite them to `/explore/…` so the files can stay where they are and the page works at `/`.

### 2. The archive

- Vite builds the old app with `base: '/archive/'` into `dist/archive/`, and `BrowserRouter`
  gets `basename="/archive"`. Its `/original/*` route then becomes `/archive/original/*` with no
  other change.
- `scripts/build-explore.mjs` (or a small post-build step) copies `dist/archive/index.html` to
  each known route folder (`dist/archive/cuddlecore/index.html` and so on, and the six
  `original/` pages), so reloads and shared links land on the right page.
- A thin banner on the archive: "This is the old WhiskedAway, kept as it was. The new Inn is at
  whiskedaway.com." (question 8).
- The archive keeps calling the genie Worker for recipes. Same origin, so the bot guard is
  unaffected.

### 3. The picture (first screen)

- Full-screen, on the same ivory paper colour as the picture's background, so any spare space
  just looks like more paper.
- Landscape screens: the 16:9 picture, contained. Portrait screens: a portrait version (needs new
  art, question 1).
- One line of real text under or over it, for people and search engines alike, for example
  "Gemma's Inn. Step inside." It's the only visible text and doubles as the button label.
- The whole picture is one button. The cursor and a gentle glow at the front door hint where to
  click. Keyboard: Enter or Space. Screen readers hear "Step inside the Inn".
- Images: webp with `srcset` (1672 px now, a 2× version later). Sizes in the performance section.

### 4. The film

**How it's made: a blend.** The whisk part is the 2D picture moved in 2.5D. The door part is the
real Blender render. A full 3D model of the outside of the Inn would be a new build of its own,
and a photoreal exterior would clash with the painted picture, which is the look Nicole chose.

| Part | Length | What happens | Made with |
|---|---|---|---|
| Swirl | about 2.5 s | Starting exactly on the picture as it sits on the page, the camera pushes toward the door while the picture turns (the whisk spins about its own axis, as if it's being whisked) and the wires sweep past with a soft motion blur. It ends with the berry door filling the screen. | A new Python script, `blender/front_door_film.py`, works frame by frame from the master picture (zoom, roll, a swirl warp easing in around the door), then ffmpeg encodes. Runs locally in a minute or two. |
| Dissolve | 0.5 s | Painted door to rendered door | ffmpeg |
| Door opens | about 4 s | Shot 2 of the fly-through: the door swings in, lamplight spills out, the camera steps into the entrance hall | Blender frames, re-rendered with the berry door (problem 1) |
| Arrival | 0.5 s | The last film frame crossfades into the live panorama at the same spot | The page |

About 7 to 8 seconds. Before the final encode I'll send Nicole a rough cut, as with the fly-through.

**Better layering later (optional).** The swirl reads more strongly if the wires and the Inn
can move separately, wires flying past the camera while the island stays put. That needs the
picture split into layers (wires, island, paper), which I can attempt with masks, or ChatGPT can
supply. I'd start with the single-layer version and only do this if the rough cut feels flat.

**Format and size.**
- MP4 (H.264), the one format every browser plays. Three encodes: 1920 × 1080 (about 3 to 4 MB),
  1280 × 720 (about 1.5 to 2 MB), and a portrait 1080 × 1920 version for phones. The page picks
  one by screen size. No WebM; it wouldn't save enough to be worth a second set.
- No separate poster frame: the picture already on screen is the first frame.
- The film plays only after a click, so autoplay rules don't bite, and sound is allowed if there
  is any.

**Loading.** The film starts downloading once the page has finished loading, unless the browser
has Data Saver on. If someone clicks before enough has arrived, the swirl waits a moment on the
picture with a small spinner on the door, rather than stuttering.

**Sound.** The Inn already has a sound switch. My suggestion: a soft whoosh for the swirl and the
door latch, both CC0, only when sound is on (question 4).

**Skip, reduced motion, Data Saver.**
- A "Skip" button appears in the corner as soon as the film starts. Esc does the same.
- Reduced motion, or Data Saver on: no film. The picture fades into the open-door frame, then
  into the hall, about 1 s in all.
- Returning visitors: see question 3.

**Weather and time.** The film is rain, late afternoon. The live hall matches the visitor's
weather and time of day, so after dark a rainy-afternoon film fades into a night-time hall. The
crossfade is short and looks like the lamps coming on, so I'd live with it rather than render
the film in ten versions. (Two versions, day and night, would cost little if Nicole minds.)

**Render cost and time (Runpod, Secure RTX 4090, about US$0.90 an hour including start-up).**

| Job | Frames | Pod time | Cost |
|---|---|---|---|
| Door opening, landscape, berry outside face | ~140 | ~15 min | ~US$0.25 |
| Door opening, portrait 1080 × 1920 | ~140 | ~15 min | ~US$0.25 |
| A rough low-res check first | ~70 | ~5 min | ~US$0.10 |
| Optional night version (both shapes) | ~280 | ~30 min | ~US$0.45 |

About **US$0.60** without the night version, about **US$1** with it. The RTX 4060 here could
render all of it for free in roughly 1 to 1.5 hours instead. The swirl costs nothing; it's 2D.

### 5. The arrival

- Land at `hall-entrance`, looking down the hall, which is where the film's camera ends.
- Gemma's arrival changes for the hall: her chat window opens with the same question ("Hello,
  love. What's the weather like for you today?") and weather chips (Rain, Fair, Change, Stormy,
  Very dry) right in the chat, since the barometer is in the kitchen. Choosing one changes the
  hall's weather, as the barometer does now. The sea window glows as a hint too.
- Visitors who deep-link into Cuddlecore keep today's barometer version.
- Fix the leftover labels: the page title becomes the Inn's name, "Back to the inn" becomes
  "Front door" (back to the picture, film skipped), and "Back to the kitchen" becomes "Back to the
  Inn". `leave_to_inn` is renamed in the analytics list to match.

### 6. The welcome and the handbell

**When.** First visit only, straight after the film (or the skip), before Gemma's weather
question. Gemma waits until the welcome is closed.

**What it says.** A short card in Gemma's voice, with her pixel avatar, so it reads as the same
person as the chat window. A draft for Nicole to rewrite:

> **Welcome to the Inn, love.**
> Have a wander. Drag to look around, and touch anything that glows.
> I'll notice what you're drawn to and bring you something to cook. Doors with dials lead to the
> other rooms.
> What I notice stays in this tab. My notebook (top right) shows you all of it.
> [Come in]

**The handbell.** On "Come in", the card shrinks and swirls up into a small brass bell at the
right-hand end of the top bar (about 0.6 s; with reduced motion it simply fades). The bell then
stays there, the same in every room.

- Ringing it: the bell swings, a small chime plays if sound is on, and the welcome card opens
  again with a second part, "Help": what the dials do, the map, the notebook, the sound switch,
  "Forget this visit", how to go back to the front door, and a link to the archive.
- It's a real `<button>`, at least 44 × 44 px, labelled "Ring for Gemma: welcome and help". The
  card is a proper dialog: focus moves into it, Esc closes it, focus returns to the bell.
- New art needed: a small brass handbell icon, drawn to sit beside the parchment chips. ChatGPT
  can make it, or I can draw a simple SVG in the house palette (question 6).

**Remembering the first visit.** One `localStorage` flag, `wa-welcomed`, holding nothing but
"yes". No ID, no date, not sent anywhere. The notebook line needs a few words added so it stays
true (question 5).

### 7. Search and sharing

- Title: "WhiskedAway: Gemma's Inn" (question 9). Description: a plain sentence about the Inn
  and Gemma, in Nicole's words.
- `og:image` and `twitter:image`: `whisk-inn-share-1200x630.jpg`, replacing the 848 KB
  `public/og-image.png`. `og:title`, `og:description`, `og:url`, `twitter:card` =
  `summary_large_image`.
- The front door has real HTML text (the heading and the one line), plus a `<noscript>` note
  and a link to the archive, so search engines and people without JavaScript get something.
- `rel="canonical"` on `/`. The archive keeps its own pages, indexable.
- `robots.txt` is unchanged. Add a small `sitemap.xml` with `/` and `/archive/`.

### 8. Analytics

- `surface` gets three values: `explore` for `/` and the Inn (it's the same page), `archive` for
  `/archive/*`, and `inn` retired. That's a two-line change in `analytics.js` and one in the
  genie Worker's `/m` route, so **both Workers deploy** with this (site, then `deploy:api`).
- New events, all without free text:

| Event | When | Params |
|---|---|---|
| `door_view` | The front door picture is shown | none |
| `door_open` | The visitor clicks in | `film` (`full`, `short` for reduced motion or Data Saver) |
| `film_skip` | Skip pressed | none (the gap since `door_open` shows how much was watched) |
| `welcome_close` | The welcome card is closed | none |
| `bell_ring` | The bell is rung | `room` |

  `film` is one new parameter (21 of the 50 GA allows), registered as a custom dimension.
- `explore_start` keeps meaning "the first room appeared", but on `/` that now includes time at
  the front door, so `load_ms` is measured from the click, not from page load.
- Cloudflare Web Analytics: page views on `/` now mean the Inn, and `/archive*` counts the old
  app. Both pages already load the beacon through `analytics.js`.
- Bot guard: no change. The front door sends events through the same visitor pass. Turnstile
  only loads when the first batch goes, about 4 seconds in, so it doesn't slow the first screen.
- Add a GA4 annotation on launch day: "Front door live; / is now the 360° Inn".

### 9. Performance

First screen, in order:

1. HTML with inline CSS for the front door (about 10 KB)
2. The picture: 240 KB webp (or the portrait version on phones), preloaded
3. Fonts (already on the page today)

That's about 300 KB before the picture is fully there. Everything else waits until after it has
painted: three.js (about 600 KB from jsDelivr, as now), the room data, the entrance hall preview
panorama (250 KB), then the film. The full 3 MB entrance panorama loads during the film. On a
normal connection all of it is in by the time the door opens. The Inn's script currently
`await`s all ten room files at the top; it will start those fetches when the page loads but not
draw anything until the visitor has clicked in.

## Build plan

1. **Art.** Ask ChatGPT for the portrait picture and a larger landscape one (prompts below).
   Nicole runs these. Meanwhile, I carry on with everything else using the current picture.
2. **Door.** Berry paint on the outside face of the front door in `hallway_build.py`. Rough
   render, then landscape and portrait door-opening frames (Runpod or the local GPU).
3. **Film.** `blender/front_door_film.py`: the swirl, the dissolve into the door frames, the
   matching last frame, the three encodes. Rough cut to Nicole, then final.
4. **Restructure.** Inn page at `/`, the old app built to `/archive/`, route copies, `_redirects`,
   path rewrites, `/explore/` alias. Check every old link resolves.
5. **Front door layer.** New files `blender/explore/front-door.js` and `front-door.css`, so the
   changes to `explore.html` stay small (other room sessions edit that file too, and smaller
   hooks mean fewer merge conflicts). Picture, click, film, skip, reduced-motion path.
6. **Welcome, bell and arrival.** The card, the swirl into the bell, help, the hall version of
   Gemma's question, renamed labels.
7. **Search, sharing, analytics.** Meta tags, share image, sitemap, the new surface values and
   events, the Worker change.
8. **Test.** Desktop and phone, both orientations, slow 3G, Data Saver, reduced motion, keyboard
   only, a screen reader pass, old links, `?count-me=off`, `?analytics=debug`. Then hand to the
   QA session.
9. **Hand-over.** Rebase onto main first. The project manager's queue for `explore.html` and
   `build-explore.mjs` is Chiapothecary, then the /explore QA fixes, then the front door. Tell the
   project manager before moving the React app to /archive/ (step 4), so it lands after the
   Inn-app QA fixes in `src/`. The project manager merges and deploys both Workers. Post-deploy checklist goes
   in the shared notes folder.

Rough time: two to three working sessions after the answers come in, plus waiting on ChatGPT.

## ChatGPT prompts (drafts)

**Portrait (for phones).** Attach `whisk-inn-master.png`.
> Same artwork, same style, same Inn and same light, recomposed as a tall portrait, 9:16. The
> whisk stands upright: the wooden handle at the bottom, the balloon of wires above it holding
> the same headland, Inn, glasshouse and sea. Keep the front door clearly visible near the centre
> of the picture, with no wire crossing it. Warm ivory paper all around, room to breathe at every
> edge. No lettering.

**Larger landscape.**
> The same picture, exactly as it is, at the largest size you can make, 16:9. If it has to change,
> extend the paper at the sides rather than changing the whisk or the Inn.

**Handbell icon (if Nicole wants it painted).**
> A small brass hand bell with a turned wooden handle, in the same gouache and watercolour style,
> on a transparent or plain ivory background, square, centred, easy to read at 40 pixels.

## Open questions for Nicole

1. **Phone art.** Ask ChatGPT for a portrait version of the picture? *Recommend: yes.* Without it,
   phones get the landscape picture small in the middle of the screen with paper above and below.
2. **The door colour.** Paint the outside of the 3D front door berry to match the picture?
   *Recommend: yes, outside face only.* About US$0.50 of rendering, and the panoramas stay as they
   are.
3. **Returning visitors.** Do they see the film again? *Recommend: they still see the picture,
   and the film plays on click with Skip ready. No welcome card.* The front door is the identity
   of the site, so it stays; the film is short.
4. **Sound in the film.** *Recommend: a soft whoosh and the door latch, only when the Inn's sound
   switch is on.* Or silent.
5. **Remembering a first visit.** OK to keep one "has been welcomed" flag in the browser, and add
   to the notebook line: "...nothing here is kept after you leave, except a note that you've been
   welcomed, so I don't say it twice"? *Recommend: yes.* The alternative is the welcome on every
   new visit.
6. **The handbell.** Painted by ChatGPT to match the picture, or a simple drawn icon?
   *Recommend: ChatGPT, using the prompt above,* with my SVG as a stand-in until it arrives.
7. **Old room links.** Send `/cuddlecore`, `/flourish` and `/sweet-spells` to the new 360° rooms,
   or to the same scene in the archive? *Recommend: the new rooms.* People who had those links
   wanted that room, and the new one is the better version.
8. **The archive.** A thin banner on the old site pointing to the new Inn? *Recommend: yes.* And
   should the archive keep Gemma's recipe requests working (they cost API calls)? *Recommend:
   yes, as it is today.*
9. **Wording.** The page title ("WhiskedAway: Gemma's Inn"), the line on the front door ("Step
   inside"), and the welcome card above. Nicole to rewrite in her voice.
10. **Night.** One film (rainy afternoon) for everyone, or a night version too? *Recommend: one
    film for now.*
