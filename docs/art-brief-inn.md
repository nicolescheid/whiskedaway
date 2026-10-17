# WhiskedAway: ChatGPT brief #4, the Inn hallway, the magic door and the Inn from outside

The Cuddlecore Kitchen is built and live. Next, per the agreed floorplan (`docs/inn-floorplan.html`),
comes the **hallway and the magic door**, then the glasshouse, then Flourish.

This brief has two parts that need **two separate ChatGPT conversations**, because they have
different looks:

- **Part A** is photoreal, like the Cuddlecore pack: concept frames for the ground-floor hallway,
  the entrance hall and the magic door. Claude rebuilds them in Blender as 360° panoramas.
- **Part B** is a storybook illustration of the whole Inn seen from outside, held inside a whisk
  the way a genie is held in a lamp. It's used as artwork on the site and in the YouTube video,
  not rebuilt in 3D.

Roles are the same as brief #1: ChatGPT is the concept artist and art director, Claude and
Blender build the real rooms, Claude puts them in the browser.

---

# Part A: the hallway and the magic door (photoreal)

## The layout, from the floorplan

Read this before prompting, so you can check ChatGPT's images against it. The house faces the
village lane at the front and the sea at the back. **Standing inside the front door looking
towards the sea, the hill side is on your left and the garden side is on your right.**

- **Entrance hall:** a wide, shallow hall across the front of the house. The front door is in
  the lane wall, with a fanlight above it. The **stairs** rise along the left side of the
  entrance hall to the landing. The **notice board** hangs in the entrance hall. A small,
  stiff **cellar door** sits under the stairs.
- **Hallway:** a narrow corridor (about 1.8 m wide and 8 m long) running straight back from the
  entrance hall to a **tall window onto the sea** at the far end. The **grandfather clock**
  stands in the hallway.
- **Doors off the hallway**, two each side:

  | | Left (hill side) | Right (garden side) |
  |---|---|---|
  | **Back, near the sea window** | Cuddlecore Kitchen | Flourish |
  | **Front, near the entrance hall** | Sweet Spells | Chiapothecary |

- **The magic dial:** every door has the same brass dial on the wall beside it, on the side
  nearer the front door. You turn the pointer to a room's name, open the door, and you're in
  that room. One notch has a small star: set it there and the door opens wherever your wander
  points.

The Cuddlecore door already exists, seen from inside the kitchen in
`art-inbox/cuddlecore/04-back-wall.png`: an old oak four-panel door, cream painted frame, round
aged brass knob. From the hallway it should look like the other side of that same door, and
all four room doors should be the same family.

## What to bring back

Save into `whiskedaway-react/art-inbox/inn-hallway/`:

| File | What |
|---|---|
| `01-entrance-hall.png` | From just inside the front door, looking down the hallway to the sea window |
| `02-hallway-to-sea.png` | Standing in the hallway, looking towards the sea window, all four doors visible |
| `03-hallway-to-front-door.png` | The reverse: looking back towards the front door and fanlight |
| `04-door-and-dial.png` | Close-up of one room door with its dial beside it |
| `05-dial-face-flat.png` | The dial plate, flat and front-on, without the pointer (texture) |
| `06-dial-pointer-flat.png` | The pointer on its own, flat, on a plain background (texture) |
| `07-door-opening-glasshouse.png` | A door mid-opening, the glasshouse glimpsed through it (mood reference) |
| `08-clock-face-closeup.png` | The grandfather clock's face |
| `09-notice-board-closeup.png` | The notice board with blank pinned papers |
| `10-materials-moodboard.png` | Materials and palette board for the hallway |

Also paste ChatGPT's **props and materials list** (Prompt A5) into `art-inbox/inn-hallway/notes.md`.
It becomes the Blender shopping list.

**Attach these two images** at the start of the conversation, as the look reference:
`art-inbox/cuddlecore/01-front-wall.png` and `art-inbox/cuddlecore/09-materials-moodboard.png`.
If you still have the original Cuddlecore conversation, you can carry on in that one instead and
skip Prompt A1.

## Prompt A1: look lock (paste first, with the two images attached)

> I'm art-directing a photoreal 3D environment for a cooking website called WhiskedAway. The
> site is an old countryside inn on a headland above the sea, and each room is a different
> kitchen that visitors can look around in 360°. The two images attached are from the first room,
> the Cuddlecore Kitchen, which is already built. Everything we make now is **the same building**:
> the ground-floor hallway and entrance hall just outside that kitchen. We'll build it in Blender;
> your images are the **concept frames** that define the look. Please lock this in for every image
> in this conversation:
>
> - **Photographic realism**, matching the attached images: like an interiors photograph for a
>   cosy-living magazine. Real materials, real light, natural wear: rubbed oak, chipped paint,
>   worn floorboards, a faded runner. Not CGI-glossy, not illustration.
> - **Camera:** full-frame, 24mm lens, eye level (about 1.6 m), level verticals, f/4 with
>   everything reasonably sharp. 16:9 landscape unless I say otherwise.
> - **Light:** the same rainy late afternoon as the kitchen. Cool, soft daylight from the sea
>   window at the end of the hallway and the fanlight over the front door. Warm light from a
>   couple of small brass wall lamps, and a thin line of warm light under some of the doors.
>   Gentle contrast, warm shadows.
> - **Materials:** the same cream limewashed plaster (#f4efe4), the same dark honey wide-plank
>   floor, low aged oak beams, aged brass (#b07f52) and deep brown (#2c2416). The hallway's accent
>   is the warm brass of the door dials and a faded runner rug in berry (#8b4d5c), cream and
>   faded blue, like the kitchen's rag rug.
> - **Era and place:** a lived-in English/Kiwi coastal inn. Timeless, not themed or kitsch.
> - **Never include:** people, text, readable labels, numbers, signs, logos, watermarks, modern
>   fittings (light switches, radiators, smoke alarms, screens).
>
> Reply with a short summary of the look. Don't make an image yet.

## Prompt A2: the three hallway views

> Here is the layout. The house faces a village lane at the front and the sea at the back.
> Standing inside the front door looking towards the sea, the hill side is on the left and the
> garden side is on the right.
>
> - The **entrance hall** runs across the front of the house: wide and shallow. The front door
>   (old painted timber, with a semicircular **fanlight** above it) is in the front wall. By the
>   door: an umbrella stand, a boot bench, coats on wooden pegs. The **staircase** rises along the
>   left side of the entrance hall, with a turned oak banister and a worn runner, and a small low
>   **cellar door** under it. A cork **notice board** in an oak frame hangs on the entrance hall
>   wall to the right of the hallway opening, with a few papers pinned to it.
> - The **hallway** runs straight back from the entrance hall: narrow (about 1.8 m wide) and
>   about 8 m long, with a long runner rug down the middle. At the far end is a **tall sash window
>   onto the grey rainy sea**. A **grandfather clock** in dark oak stands against the hallway wall.
> - **Four doors** open off the hallway, two on each side, all the same family as the attached
>   kitchen door (old oak, four panels, cream painted frame, round brass knob). On the left: the
>   back door (nearest the sea window) leads to the Cuddlecore Kitchen, the front one to a bakery.
>   On the right: the back door leads to a sunny kitchen, the front one to an apothecary
>   still-room. One door on the right is slightly ajar, with warm light and a hint of greenery
>   behind it.
> - **Beside every door** is a round **brass dial plate**, about 20 cm across, fixed to the wall
>   at chest height on the side of the door nearer the front door, with a brass pointer you can
>   turn. It's the same dial at every door. It should look like it belongs to the house: old,
>   handsome and a little magical, not steampunk.
>
> First: the **entrance hall from just inside the front door**, looking straight down the hallway
> to the sea window at the far end. The stairs rise on the left, the notice board is to the right
> of the hallway opening, and the grandfather clock is visible a little way down the hallway.

Then, in the same conversation:
- "Now **from inside the hallway, looking towards the sea window**: all four doors visible, each
  with its brass dial beside it, two on the left and two on the right. Same light, same moment."
- "Now **the reverse**: standing near the sea window, looking back up the hallway towards the
  entrance hall, the front door and its fanlight. Where the stairs show, they are now on the right."

## Prompt A3: the magic door and its dial

> Now a **close-up of one room door with its dial**: the Cuddlecore Kitchen door, shot from about
> 1.2 m away, slightly off to one side so the dial reads clearly. The round brass dial plate is
> on the wall beside the door at chest height (about 1.3 m). Around its rim are **nine positions**,
> evenly spaced: eight small **blank engraved name plates** and one notch marked with a small
> engraved **star**, at the top. A brass pointer in the middle, like a clock hand with a little
> knob to turn it, is set to one of the plates. The brass is worn brighter where hands have
> turned it. A faint warm glow around the star notch, nothing more.
>
> **The name plates must be blank**: no letters, no numbers, no squiggles that look like writing.
> I'll add the room names myself afterwards.

Then the two flat texture images:
- "Now **the dial plate on its own, for use as a texture**: perfectly front-on, perfectly
  circular, no perspective, filling a square image. Even soft studio light, no reflections of a
  room, no shadows. The same nine positions: eight blank engraved name plates evenly spaced round
  the rim and the star notch at the top. **Leave the pointer off**: just the plate and the centre
  spindle. Plain neutral background outside the circle."
- "Now **the pointer on its own**: the same brass pointer, flat and front-on, pointing straight
  up, centred on a plain neutral background, square image, even light."

**Why blank plates:** AI images garble lettering, and the dial needs exactly these eight names:
Cuddlecore, Flourish, Sweet Spells, Chiapothecary, Glasshouse, Nourish Academy, Cravings Decoded,
The Hall. Claude engraves them onto the plates in Blender, so they're crisp and spelled right.
If ChatGPT adds any letters or marks on the plates, ask: "Same dial, but every name plate
completely blank and smooth."

## Prompt A4: the door opening, and the details

> Now **a room door mid-opening**, seen from the hallway: the door swung about a third of the way
> open, the dial beside it set to one of the plates. Through the gap, instead of the room you'd
> expect, we glimpse **a glasshouse full of herbs and morning sun**: green leaves, terracotta pots,
> bright warm light spilling into the dim, rainy hallway and across the floorboards. It should
> feel quietly magical: the light is the magic, no sparkles or swirls.

This one is a mood reference for the transition between rooms, so it can be looser than the
others. Then:
- "A **close-up of the grandfather clock's face**: painted dial with a moon-phase arch at the top,
  brass spandrels, blackened hands. Use simple painted dots or bars for the hours, **no numerals**.
  Front-on, square."
- "A **close-up of the notice board**: oak frame, cork, five or six papers pinned at slightly
  different angles with brass pins: a small card, a folded note, a seed packet, a pressed leaf.
  **The papers must be blank or show only faint smudges, no readable text.** Front-on."
- "A **materials moodboard for the hallway**: swatches of the plaster, floorboards, oak beams,
  the door oak, the runner rug, the dial brass (worn and unworn), the clock case, the cork, on a
  linen background, photographed from above."

Claude adds the real notices later (what's in season, tonight's soup, whatever Gemma pins up),
and the clock numerals to match the kitchen clock.

## Prompt A5: the Blender shopping list

> Looking at all the images we made, write a props and materials list I can use to build this
> hallway and entrance hall in Blender. Group it as: **structure** (walls, beams, floor, sea
> window, front door and fanlight, stairs); **doors and dials** (the four room doors, the cellar
> door, the dial plate and pointer, with sizes); **furniture** (grandfather clock, notice board,
> boot bench, umbrella stand, coat pegs); **set dressing** (small objects); **materials** (each with
> colour, roughness and how worn); **lighting** (each light source, colour temperature, rough
> brightness). Mark anything that's essential to the mood with ★.

**Keep pushing on:** the left/right layout ("Cuddlecore must be the back door on the left, near
the sea window"), consistency between views ("the sea window, clock and runner must match the
first image"), the dial ("same dial at every door, always on the side nearer the front door"),
and realism ("less polished, more lived-in").

## Part A checklist

- [ ] The doors are in the right places: Cuddlecore back left, Flourish back right, Sweet Spells
      front left, Chiapothecary front right (seen facing the sea)
- [ ] Stairs on the left in view 1 (and on the right in view 3, if they show); sea window at the far end in view 2
- [ ] Every door has the same dial, on the side nearer the front door
- [ ] The doors look like the hallway side of the kitchen door in `04-back-wall.png`
- [ ] Same plaster, floor, beams and rainy light as the Cuddlecore pack
- [ ] The flat dial is truly round and front-on: nine evenly spaced positions, star at the top,
      every name plate blank
- [ ] No readable text or garbled lettering anywhere: notice board, clock face, dial

---

# Part B: the Inn from outside, inside a whisk (storybook illustration)

**Start a new ChatGPT conversation for this.** The photoreal look lock from Part A would fight
this style. If you like, attach a screenshot of the ground-floor plan from
`docs/inn-floorplan.html` so ChatGPT can see the layout.

This picture gives visitors a sense of the whole building from outside: the rooms they've been
in and the ones still to come. It will be used on the site (home page and loading screen) and in
the YouTube video about the build.

## What to bring back

Save into `whiskedaway-react/art-inbox/inn-exterior/`:

| File | What |
|---|---|
| `01-whisk-inn-day.png` | The main plate, a bright morning, portrait 4:5 |
| `02-whisk-inn-dusk.png` | The same picture at dusk, windows lit, portrait 4:5 |
| `03-whisk-inn-wide.png` | Wide version (21:9) for the home page and loading screen |
| `04-whisk-inn-16x9.png` | 16:9 version for the YouTube video |

## Prompt B1: the illustration

> I'd like a storybook illustration for a cooking website called WhiskedAway. The site is an old
> countryside inn by the sea, where each room is a different kitchen, and a kind kitchen genie
> called Gemma helps visitors decide what to eat.
>
> **The idea:** the whole inn sits inside a big balloon whisk, the way a genie lives inside a lamp.
> The whisk lies tilted on its side as if resting on a kitchen table, and its curved wires arch
> over the inn and its little patch of land like a glass dome or a birdcage. A curl of golden
> steam, with a faint shimmer in it, drifts out of the end of the handle like smoke from a
> genie's lamp. Keep the wires few and fine enough that the house reads clearly between them.
>
> **The style:** a classic children's-book plate, warm and hand-made: ink line with watercolour
> and gouache, soft paper texture, gentle light. Think of an old, much-loved picture book. Not
> photoreal, not 3D, not glossy digital art.
>
> **The inn** sits on a grassy headland with the sea behind it. We're looking at it from the
> front, slightly from the right, from the village lane:
>
> - A two-storey cottage-like inn: cream limewashed walls, a grey slate roof, two chimneys, one
>   gently smoking. Small-paned windows, all glowing warm. A front door with a semicircular
>   fanlight, and a **bay window** on the left of the front.
> - A **round turret** rising at the back left corner (the hill side), a storey taller than the
>   roof, with a conical roof and windows all round. A small telescope pokes out of one window.
> - A **glasshouse** attached along the right-hand side (the sunny side), full of green plants,
>   opening onto a cottage **herb and flower garden** with a low stone wall.
> - The **sea** behind, with a soft headland across the bay. A **village lane** in front, with
>   a lamppost and a hanging inn sign showing only a small painted whisk.
> - A ginger-and-white cat on the garden wall.
>
> **Never include:** people, text, lettering on the sign, logos, watermarks.
>
> Colours: cream, honeyed oak, aged brass, deep brown, dusty berry (#8b4d5c), sea blues and
> garden greens. Portrait 4:5. Make the **day** version first: a bright, fresh morning.

Then, in the same conversation:
- "Now **the same picture at dusk**: same composition, nothing moved. A deep blue and apricot sky,
  every window glowing warm, the turret window brightest, a first star over the sea, the golden
  steam from the whisk handle glowing more strongly."
- "Now **a wide version, 21:9**, for a website home page: the same whisk and inn, smaller in the
  frame and placed to one side, with calm sky and sea around it so text can sit on top later."
  (Use whichever time of day you prefer.)
- "Now **a 16:9 version** of the same picture, for a video."

**If the whisk turns into a cage of too many wires:** "Fewer, finer wires: a real balloon whisk
has about eight. The house should read clearly."

**If it goes photoreal or 3D:** "Flatter and more hand-painted, like a watercolour plate in an old
picture book."

**If the inn sign or anywhere else grows lettering:** "Same picture, no lettering anywhere: the
sign shows only a painted whisk."

## Part B checklist

- [ ] It reads at a glance as an inn held inside a whisk, with steam from the handle like a lamp
- [ ] Turret at the back left, glasshouse and garden on the right, sea behind, lane in front
- [ ] It looks hand-illustrated, not photoreal or 3D
- [ ] Day and dusk versions match in composition
- [ ] No people and no lettering anywhere, including the inn sign
