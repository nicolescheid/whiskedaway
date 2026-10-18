# WhiskedAway: ChatGPT brief #9, Sweet Spells

**Sweet Spells** is the tome for treats that happen to be good for you. Visitors pick a flavour
(chocolate, fruity, creamy, crunchy, warm and cozy, frozen) and an occasion, and Gemma casts a
sweet spell, with "optional ways to level up your spell".

Nicole's picture of the room (18 October 2026): **a pure magician's den**, because how else could
you make delicious desserts healthy except by magic? The room's instrument is the **music box on
a cake stand**, whose lid opens to a turning dancer.

This brief also makes **the view of the village lane** for both front rooms: the Sweet Spells
bay window and the Chiapothecary shop window (brief #8) look onto the same lane.

Roles are the same as the earlier briefs: ChatGPT makes the concept frames, Claude builds the room
in Blender and renders it as 360° panoramas.

---

## The layout, from the floorplan

- **Where:** ground floor, at the front of the Inn (the village lane side), on the hill side.
  Across the hallway from the Chiapothecary, and in front of Cuddlecore.
- **Size:** about 4.5 m × 4.5 m, with the Inn's beams and plaster, here hung with drapes and
  crowded with a magician's things.
- **Front wall:** a deep **bay window onto the village lane**, with a window seat.
- **Hallway wall:** the old oak four-panel door back to the hallway.
- **Hill wall:** an old fireplace, now a magician's hearth.
- **Back wall:** an inside wall (Cuddlecore is on the other side), lined with shelves.

## What's in it

These are what visitors click, so each must be distinct and uncluttered:

- **The hero: the spell table.** A heavy old table with a marble pastry slab, where a dessert is
  being made by magic: a whisk turning in a bowl on its own, berries and a ribbon of dark
  chocolate hanging in the air mid-pour, a faint golden sparkle. The magic is gentle and
  believable, photographed as if it were really happening.
- **The music box on a cake stand:** a little carved music box with its lid open and a tiny
  dancer, sitting on a tiered cake stand among small treats. The room's instrument.
- **The spell books:** a shelf of old leather books with **blank** spines, and one open on a
  brass lectern showing a hand-painted illustration of a dessert (no writing).
- **The potion cabinet:** a glass-fronted cabinet of bottles and jars that glow softly: berry
  and pomegranate syrups, honey, dates, cacao, vanilla, rosewater, orange blossom.
- **Bell jars:** glass cloches over finished desserts that look almost too good to be real: a
  fruit tart, dark chocolate truffles, a berry pavlova, a yoghurt and fruit parfait.
- **The hearth:** a copper sugar pan on a small fire, with a curl of coloured steam rising.

**Accent colour: rose (#c27a8c)**, with deep plum velvet drapes and touches of gold. If you'd
rather a different accent, change it in Prompt S2.

**Kindly magic only.** Storybook enchantment, the kind a good fairy godmother would keep. No
occult symbols: no pentagrams, skulls, black candles, eyes, runes or anything spooky.

## What to bring back

Save into `whiskedaway-react/art-inbox/sweet-spells/`:

| File | What |
|---|---|
| `01-spell-table-bay-window.png` | Main view: the spell table, with the bay window behind it (the **composition master**) |
| `02-music-box.png` | The music box on its cake stand, the bell jars nearby |
| `03-books-lectern.png` | The back wall: spell books and the open book on its lectern |
| `04-potion-cabinet-hearth.png` | The hill wall: the hearth and the potion cabinet |
| `05-hallway-door.png` | The hallway wall and the oak door |
| `06-spell-closeup.png`, `07-music-box-closeup.png`, `08-bell-jars-closeup.png` | Close-ups |
| `09-materials-moodboard.png` | Materials and palette board |
| `10-book-illustration-flat.png`, `11-velvet-tile.png`, `12-star-chart-flat.png` | Flat artwork (Prompt S5) |
| `14-lane-rain.png` … `18-lane-very-dry.png` | The village lane in five weathers (Prompt S4) |
| `19-lane-night-rain.png` … `23-lane-night-very-dry.png` | The lane at night in five weathers |

File numbers 14 to 23 follow Cuddlecore's and Flourish's, so the build scripts treat all the rooms the same way.

Also paste ChatGPT's **props and materials list** (Prompt S6) into `art-inbox/sweet-spells/notes.md`.

**Attach these images** at the start of the conversation:
`art-inbox/cuddlecore/01-front-wall.png`, `art-inbox/cuddlecore/09-materials-moodboard.png`,
`art-inbox/inn-hallway/02-hallway-to-sea.png` and `art-inbox/inn-exterior/whisk-inn-master.png`
(the storybook Inn, for the village and lane around it).

## Prompt S1: look lock (paste first, in a fresh conversation, with the images attached)

> I'm art-directing a photoreal 3D environment for a cooking website called WhiskedAway. The
> site is an old countryside inn on a headland above the sea, and each room is one visitors can
> look around in 360°. The attached images are from rooms already designed: the Cuddlecore
> Kitchen and the inn's hallway, plus a storybook picture of the inn from outside. We're now
> making **Sweet Spells**, in the same building. We'll build it in Blender; your images are the
> **concept frames** that define the look. Please lock this in for every image in this conversation:
>
> - **Photographic realism**, matching the attached photoreal rooms, even for the magic: the
>   enchantment should look photographed, as if it were really happening. Real materials, real
>   light, natural wear. Not CGI-glossy, not illustration.
> - **Camera:** full-frame, 24mm lens, eye level (about 1.6 m), level verticals, f/4 with the
>   whole room reasonably sharp. 16:9 landscape unless I say otherwise.
> - **Light:** early evening. The last blue daylight through the bay window, candlelight, the
>   glow of the fire and of the potion bottles.
> - **Era and place:** the same countryside inn: timber beams, cream limewashed plaster, worn
>   floorboards, here hung with drapes and crowded with a kindly magician's things.
> - **Base palette:** cream plaster (#f4efe4), honeyed oak, aged brass (#b07f52), deep brown
>   (#2c2416), plus this room's accent (I'll give it next).
> - **Never include:** people, text, readable labels, numbers, logos, watermarks, plastic,
>   screens, or occult symbols (pentagrams, skulls, runes, eyes).
>
> Reply with a short summary of the look. Don't make an image yet.

## Prompt S2: the Sweet Spells views

> Using our locked look: **Sweet Spells**, a kindly magician's den where healthy desserts are
> made delicious by magic. Accent colour: **rose (#c27a8c)**, with deep plum velvet drapes and
> touches of gold. Storybook enchantment, never spooky.
>
> The room is about 4.5 m × 4.5 m:
>
> - **Front wall:** a deep **bay window** onto a village lane at dusk, with a cushioned window seat.
> - **In front of it, the spell table:** a heavy old table with a marble pastry slab. A dessert
>   is being made by magic: a whisk turning in a bowl on its own, a handful of raspberries and a
>   ribbon of dark chocolate hanging in mid-air as if being poured, a faint golden sparkle.
> - **Near the table:** a tiered **cake stand** with small treats and a little carved **music box**
>   on top, lid open, a tiny dancer inside. Glass **bell jars** over finished desserts: a fruit
>   tart, dark chocolate truffles, a berry pavlova, a yoghurt parfait.
> - **Back wall:** shelves of old leather **spell books** with blank spines, and one book open on
>   a brass lectern, showing a hand-painted dessert illustration and no writing.
> - **Hill wall:** an old fireplace with a small fire and a **copper sugar pan**, a curl of
>   rose-coloured steam rising from it. Beside it, a glass-fronted **potion cabinet** of softly
>   glowing bottles and jars: berry syrups, honey, dates, cacao, vanilla, rosewater.
> - **Hallway wall:** an old oak four-panel door like the one in the attached hallway image.
>
> First: standing near the hallway door, **looking across the spell table to the bay window**.

Then, in the same conversation:
- "Now **the music box on its cake stand** and the bell jars. Same light, same moment."
- "Now **the back wall**: the spell books and the open book on its lectern."
- "Now **the hill wall**: the fireplace, the sugar pan and the potion cabinet."
- "Now **the hallway wall** with the oak door."
- "Close-up of the spell in progress: the whisk, the floating berries and chocolate. Shallow
  depth of field." Then the same for "the open music box and its dancer" and "the bell jars".
- "A materials moodboard for this room: swatches of plum velvet, rose silk, the marble slab,
  old leather, gold leaf, brass, copper, glass bottles, beeswax, on a linen background,
  photographed from above."

## Prompt S3: the music box

The music box is the room's instrument (visitors lift the lid and it plays), so Claude needs to see it clearly:

> "The **music box** on its own, closed and open: a small carved wooden box with rose and gold
> inlay, a tiny dancer on a spindle inside, and a winding key. Plain background, even light, no text."

## Prompt S4: the village lane (for both front rooms)

The window glass is built in 3D, so the view outside needs to be its own image. **Both front
rooms use it:** Sweet Spells' bay window and the Chiapothecary's shop window, about six metres
apart along the same front wall. So make it very wide.

> "Now the **view of the village lane** from the front of the inn, with no window, frame or room
> in shot: a narrow cobbled lane running left to right, a low stone wall, a row of old cottages
> opposite with painted doors and window boxes, a little bakery, a lamp post, umbrellas propped
> in a doorway, a bicycle against a wall, the hills rising behind the rooftops. No people. Standing
> at a ground-floor window, eye height about 1.6 m, level horizon. **The widest landscape format
> you can make** (32:9 if you can, at least 21:9). [weather]."

Make the rainy version first, then each of the others from it:

> "Now the **exact same view**: identical composition, cottages, lane, lamp post and hills,
> nothing moved, but [weather]."

| File | Barometer | [weather] |
|---|---|---|
| `14-lane-rain.png` | Rain | "a rainy late afternoon: wet cobbles shining, rain in the air, puddles, umbrellas dripping in a doorway, warm light in a few windows" |
| `15-lane-fair.png` | Fair | "a clear, bright day: sun on the painted doors, window boxes in flower, blue sky over the hills" |
| `16-lane-change.png` | Change | "a soft misty morning: sea fog drifting along the lane, the far end lost in it, pale light" |
| `17-lane-stormy.png` | Stormy | "a wild storm: rain driving sideways, a shop sign swinging, leaves blowing along the cobbles, dark sky" |
| `18-lane-very-dry.png` | Very Dry | "a hot, still late-summer afternoon: dusty cobbles, a cat asleep in the shade, pale hazy sky, wilting window boxes" |

Then the night set, starting from the rainy master each time:

> "Now the **exact same view as the rainy master**, nothing moved, but **at night, about 11pm**,
> [weather]. Dark, lit only by the lamp post and a few warm cottage windows."

Use these for [weather]: rain ("rain shining under the lamp post"), fair ("a clear starry sky over the
rooftops"), change ("fog haloes round the lamp post"), stormy ("rain driving sideways through the lamplight"),
very dry ("a warm still night, a moth at the lamp"). Save as `19-lane-night-rain.png` to `23-lane-night-very-dry.png`.

**Check alignment** by flicking between two versions. If the cottages, lane or lamp post move, ask:
"The composition shifted. Redo it matching the rainy master exactly."

## Prompt S5: flat artwork (textures inside the 3D room)

- "**A hand-painted illustration of a berry pavlova** on an old book page, watercolour and
  gold leaf, cream paper with deckled edges, flat scan, portrait 3:4, **no writing at all**."
- "**A seamless plum velvet damask pattern** with a faint rose and gold motif, top-down, evenly lit, square, tileable."
- "**An old star chart** of made-up constellations shaped like whisks, spoons and cherries, ink
  and gold on dark blue paper, flat scan, square, **no lettering**."

If ChatGPT adds any writing, ask: "Same image, but with no text or lettering at all."

## Prompt S6: the Blender shopping list

> Looking at all the images we made, write a props and materials list I can use to build this
> room in Blender. Group it as: **structure** (walls, beams, floor, the bay window and seat, the
> fireplace, the hallway door, with sizes); **furniture** (spell table, shelves, lectern, potion
> cabinet, cake stand); **hero objects** (the spell in progress, the music box, the books, the
> bottles, the bell jars, the sugar pan); **magic effects** (what floats, glows or moves, and
> how); **set dressing**; **materials** (each with colour, roughness and how worn); **lighting**
> (dusk through the window, candles, firelight, the glowing bottles, colour temperature, rough
> brightness). Mark anything that's essential to the mood with ★.

**Keep pushing on:** believable magic ("make the floating chocolate look photographed, not
painted in"), kindness ("cosier, less spooky"), and readability ("the music box is getting
lost; give it some light").

---

## Checklist

- [ ] It looks like the same Inn: same beams, plaster, oak door
- [ ] It reads as a kindly magician's den, never spooky, no occult symbols
- [ ] The spell table, music box, books, potion cabinet and bell jars are each easy to pick out
- [ ] The bay window is on the front wall, the hearth on the hill wall
- [ ] The five lane views line up exactly, and so do the five night views
- [ ] No people, and no readable text or garbled lettering anywhere
