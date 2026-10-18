# WhiskedAway: ChatGPT brief #6, the Flourish kitchen

Flourish is third in the build order (`docs/inn-floorplan.html`), after the hallway and the
glasshouse. The glasshouse art is already in, so this brief gets Flourish's art ready while the
glasshouse is built in Blender.

**Flourish** is the tome for building-you-up meals: maximum nourishment for becoming your best
self. Where Cuddlecore is the soft room for a hard day, Flourish is the bright, busy, morning
kitchen: sun on the table, food straight from the garden, a sense of getting going.

Roles are the same as the earlier briefs: ChatGPT makes the concept frames, Claude builds the room
in Blender and renders it as 360° panoramas.

---

## The layout, from the floorplan

Read this before prompting, so you can check ChatGPT's images against it.

- **Where:** ground floor, at the back of the Inn (the sea side), on the sunny side. It sits
  straight across the hallway from Cuddlecore.
- **Size:** about 4.5 m × 4.5 m, like Cuddlecore, with the same beams, limewashed plaster and
  wide floorboards. Same Inn, different character.
- **Hallway wall:** the old oak four-panel door back to the hallway (the hallway side has the
  brass dial; this side is just the door).
- **Sea wall:** a big window onto the sea. It's the same coastline Cuddlecore sees, from a few
  metres further along the same wall.
- **Garden wall:** the **back door to the kitchen garden**, a stable door (split in two, top and
  bottom), with the top half open in the concept frames so the morning sun and the garden come in.
- **Front wall:** an inside wall (the Chiapothecary is on the other side), with a big dresser.

## What's in it

These objects are what visitors click, so each must be distinct and uncluttered.

- **The hero: a big scrubbed pine table** in the middle of the room, in the morning sun, laid
  out with the makings of a good breakfast and lunch: a bowl of eggs, a loaf, greens and
  herbs just brought in, a wooden board, a bowl of oats and seeds. This is Flourish's
  equivalent of Cuddlecore's pot.
- **A range** (a bigger, busier one than Cuddlecore's) with a heavy pan and a kettle, and
  copper pans hanging from a rail above.
- **A trug basket of fresh vegetables** on the floor by the back door, soil still on them.
- **A horn phonograph** on a side table or the end of the dresser: wind-up, brass horn,
  wooden case. It's the room's instrument and visitors will wind it up to play music.
- **The dresser** on the front wall: plates, jugs, and jars of grains, pulses, nuts and seeds.
- **A window seat or a sunny ledge** under the sea window with a few pots of herbs.

**Accent colour: marigold (#d9a441)** in the linen, the glazed jugs and a striped runner,
alongside fresh garden greens. Cuddlecore has dusty berry; the glasshouse has sage. If you'd
rather a different accent, change it in Prompt F2.

## What to bring back

Save into `whiskedaway-react/art-inbox/flourish/`:

| File | What |
|---|---|
| `01-table-sea-window.png` | Main view: the table, with the sea window behind it (the **composition master**) |
| `02-back-door.png` | The garden wall: the stable door, top half open, the trug basket |
| `03-range.png` | The range, the copper pans, the kettle |
| `04-dresser-phonograph.png` | The front wall: the dresser and the phonograph |
| `05-hallway-door.png` | The hallway wall and the oak door |
| `06-table-closeup.png`, `07-phonograph-closeup.png`, `08-trug-closeup.png` | Close-ups |
| `09-materials-moodboard.png` | Materials and palette board |
| `10-botanical-flat.png`, `11-runner-tile.png`, `12-tea-towel-tile.png` | Flat artwork (see Prompt F5) |
| `14-window-rain.png` … `18-window-very-dry.png` | The sea view in five weathers (see Prompt F3) |
| `19-night-rain.png` … `23-night-very-dry.png` | The sea view at night in five weathers |
| `24-garden-rain.png` … `28-garden-very-dry.png` | The kitchen garden through the back door, five weathers |
| `29-garden-night.png` | The kitchen garden at night |

File numbers 14 to 23 match Cuddlecore's, so the build scripts can treat both kitchens the same way.

Also paste ChatGPT's **props and materials list** (Prompt F6) into `art-inbox/flourish/notes.md`.
It becomes the Blender shopping list.

**Attach these four images** at the start of the conversation, as the look reference:
`art-inbox/cuddlecore/01-front-wall.png`, `art-inbox/cuddlecore/09-materials-moodboard.png`,
`art-inbox/cuddlecore/14-window-rain.png` and `art-inbox/inn-hallway/02-hallway-to-sea.png`.

## Prompt F1: look lock (paste first, in a fresh conversation, with the four images attached)

> I'm art-directing a photoreal 3D environment for a cooking website called WhiskedAway. The
> site is an old countryside inn on a headland above the sea, and each room is a kitchen or
> room visitors can look around in 360°. The attached images are from rooms already built: the
> Cuddlecore Kitchen, the view from its window, and the inn's hallway. We're now making
> **the Flourish kitchen**, in the same building. We'll build it in Blender; your images are the
> **concept frames** that define the look. Please lock this in for every image in this conversation:
>
> - **Photographic realism**, matching the attached images: like an interiors photograph for a
>   cookbook or a cosy-living magazine. Real materials, real light, natural wear: scrubbed
>   wood, chipped enamel, creased linen, flour on the board. Not CGI-glossy, not illustration.
> - **Camera:** full-frame, 24mm lens, eye level (about 1.6 m), level verticals, f/4 with the
>   whole room reasonably sharp. 16:9 landscape unless I say otherwise.
> - **Light:** a bright, clear early morning. Low sun streaming in through the open top of the
>   back door and across the table, soft daylight from the sea window, long warm shadows.
> - **Era and place:** the same lived-in English/Kiwi country inn as the attached images: timber
>   beams, cream limewashed plaster, worn wide-plank floor. Timeless, not themed or kitsch.
> - **Base palette:** cream plaster (#f4efe4), honeyed oak, aged brass (#b07f52), deep brown
>   (#2c2416), plus this room's accent (I'll give it next).
> - **Never include:** people, text, readable labels, numbers, logos, watermarks, modern
>   appliances, plastic, or screens.
>
> Reply with a short summary of the look. Don't make an image yet.

## Prompt F2: the Flourish kitchen views

> Using our locked look: the **Flourish kitchen**, the brightest room in the inn, for someone
> who wants to build themselves up and feel well. It's a busy, sunny morning kitchen. Accent
> colour: **marigold (#d9a441)** in the linen, a striped table runner and some glazed jugs,
> alongside the fresh greens of garden produce.
>
> The room is about 4.5 m × 4.5 m. Here's what's on each wall. These objects are what visitors
> click, so each must be distinct and uncluttered:
>
> - **Sea wall:** a big timber sash window looking out over a garden to the sea. Below it, a
>   sunny ledge with pots of herbs.
> - **In the middle of the room:** a **big scrubbed pine table**, the hero of the room, in the
>   morning sun: a bowl of brown eggs, a loaf on a board, a bunch of greens and herbs just picked,
>   a bowl of oats and seeds, a marigold striped runner. Mismatched wooden chairs.
> - **Garden wall:** an old timber **stable door** to the kitchen garden, **top half open**,
>   sunlight pouring in, the garden visible beyond. On the floor beside it, a **wooden trug basket**
>   of fresh vegetables with soil on them (carrots with tops, beetroot, kale, beans).
> - **Range:** a cream enamel range, bigger than a cottage one, with a heavy cast-iron pan and a
>   kettle, and **copper pans hanging from a rail** above.
> - **Front wall:** a tall painted **dresser** with plates, jugs, and glass jars of grains, pulses,
>   nuts and seeds. On a small side table at the end of it, a **wind-up horn phonograph**: wooden
>   case, brass horn, a record on the turntable.
> - **Hallway wall:** an old oak four-panel door to the inn's hallway, like the one in the
>   attached hallway image.
>
> First: standing near the hallway door, **looking across the table to the sea window**, with the
> stable door's sunlight coming in from the side.

Then, in the same conversation:
- "Now **the garden wall**: the stable door with its top half open, the trug basket beside it,
  the kitchen garden beyond. Same light, same moment."
- "Now **the range**, the copper pans and the kettle."
- "Now **the front wall**: the dresser and the phonograph at its end."
- "Now **the hallway wall**: the old oak door back to the inn."
- "Close-up of the table: eggs, bread, greens, the runner, in the sun. Shallow depth of field."
  Then the same for "the horn phonograph" and "the trug basket of vegetables".
- "A materials moodboard for this room: swatches of the scrubbed pine, the plaster, the
  floorboards, copper, the cream enamel, the brass of the phonograph horn, the marigold linen
  and runner, glazed jugs, garden soil, on a linen background, photographed from above."

## Prompt F3: the sea view through the window, in five weathers

The window glass is built in 3D, so the view outside needs to be its own image, placed a few
metres beyond the window in Blender. Visitors turn the barometer to change the weather, so
we need **the same view in five weathers**, like Cuddlecore.

**It's the same coastline Cuddlecore sees**, so attach `art-inbox/cuddlecore/14-window-rain.png`
again and say:

> "Now the **view through the Flourish window**, with no window, frame, glass, curtains or room
> in shot. It's the same coastline as the attached Cuddlecore view, the same bay and headlands,
> seen from a window about 5 metres further along the same wall toward the garden, so the bay
> sits a little further to the left. In the foreground, the inn's kitchen garden: raised beds,
> a low stone wall, a few fruit trees. Standing at a ground-floor window, eye height about 1.6 m,
> level horizon about 45% of the way up. The widest landscape format you can make (21:9 or wider).
> [weather]. No people, animals, cars, text or signs."

Make the rainy version first, then for each of the others:

> "Now the **exact same view**: identical composition, horizon, garden, bay and headlands,
> nothing moved, but [weather]."

| File | Barometer | [weather] |
|---|---|---|
| `14-window-rain.png` | Rain | "a rainy morning: steady light rain, low cloud and mist in the distance, soft even light, the sky still showing cloud detail" |
| `15-window-fair.png` | Fair | "a clear, bright morning: blue sky, low sun on the garden and fields, the sea sparkling" |
| `16-window-change.png` | Change | "a soft misty morning: sea fog drifting in the bay, headlands half hidden, pale pearly light" |
| `17-window-stormy.png` | Stormy | "a wild storm: dark heavy cloud, wind bending the plants, white-capped waves on the headlands, rain driving sideways" |
| `18-window-very-dry.png` | Very Dry | "a hot, still, hazy late-summer morning: dry golden grass, heat haze over the bay, pale sky, the sea flat and glassy" |

Then the night set, starting from the rainy master each time:

> "Now the **exact same view as the rainy master**, nothing moved, but **at night, about 11pm**,
> [weather]. Genuinely dark: the land mostly silhouette, with detail only where there's light.
> No moon in the sky itself."

Use the same five weathers and the same night descriptions as Cuddlecore's night brief
(`docs/art-brief-cuddlecore-night.md`), saved as `19-night-rain.png` to `23-night-very-dry.png`.

**Check alignment** by flicking between two versions. If the garden, bay or headlands move, ask:
"The composition shifted. Redo it matching the rainy master exactly."

## Prompt F4: the kitchen garden through the back door

The open top of the stable door looks onto the kitchen garden, so it needs its own outside view:

> "Now the **view out through the back door**, with no door, frame or room in shot: the inn's
> kitchen garden right outside, a brick path between raised beds of vegetables and herbs, a
> water butt, a bench against the wall, the glasshouse roof catching the light further along the
> house on the right, and the sea glimpsed on the left beyond the garden wall. Eye height about 1.6 m, level
> horizon. The widest landscape format you can make. [weather]."

Same five weathers as Prompt F3, with identical framing, saved as `24-garden-rain.png` to
`28-garden-very-dry.png`. Then one night version, `29-garden-night.png`: "the same view at night,
about 11pm, dark, with warm light from the inn's windows falling on the path."

The garden doesn't change with the seasons yet. Only the glasshouse does. If the garden should
follow the seasons too, that's a later set.

## Prompt F5: flat artwork (used as textures inside the 3D room)

- "A small framed botanical watercolour of beetroot, kale and a sprig of rosemary, on cream paper,
  **no text**, flat scan, portrait 4:5."
- "A seamless repeating pattern for a woven table runner: marigold and cream stripes with a thin
  green line, top-down, evenly lit, square, tileable."
- "A seamless repeating pattern for a linen tea towel: cream with a marigold check, top-down,
  evenly lit, square, tileable."

**No lettering anywhere.** AI images garble it. Claude adds any words in Blender. If ChatGPT adds
letters, ask: "Same image, but with no text or lettering at all."

## Prompt F6: the Blender shopping list

> Looking at all the images we made, write a props and materials list I can use to build this
> kitchen in Blender. Group it as: **structure** (walls, beams, floor, the sea window, the stable
> door, the hallway door, with sizes); **furniture** (table, chairs, range, dresser, side table,
> window ledge); **hero objects** (the table setting, the phonograph, the trug basket, the copper
> pans, the dresser jars); **set dressing** (small objects); **materials** (each with colour,
> roughness and how worn); **lighting** (the morning sun, the daylight from the sea window, colour
> temperature, rough brightness). Mark anything that's essential to the mood with ★.

**Keep pushing on:** consistency between walls ("the window and range must match the first
image"), realism ("less tidy, more lived-in: crumbs, flour, soil on the vegetables"), and
readability ("the phonograph is getting lost; give it some space and light").

---

## What Claude adds in Blender, not ChatGPT

- The Inn-wide things that already exist in Cuddlecore: the barometer, the wall clock and the
  energy candles, if Flourish gets its own set. Leave some empty plaster beside the sea window.
- Any lettering, and the glow on clickable objects.

## Checklist

- [ ] It looks like the same Inn as Cuddlecore and the hallway: same plaster, beams, floor, oak door
- [ ] The sea window, the stable door and the hallway door are on the right walls (see the layout)
- [ ] The table reads clearly as the hero, and the phonograph, trug and dresser are easy to pick out
- [ ] The sea view is recognisably the same coastline as Cuddlecore's
- [ ] The five weather views line up exactly, and so do the five night views and the garden views
- [ ] No people, and no readable text or garbled lettering anywhere
