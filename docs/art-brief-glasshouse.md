# WhiskedAway: ChatGPT brief #5, the glasshouse

The hallway and the magic door are built. Next in the build order (`docs/inn-floorplan.html`) is
**the glasshouse**: a new room for herbs and flowers you can grow, and recipes for them.

The plants lean toward **medicinal, health, beauty and wellness** plants, because these are what
the recipes will call on. Every plant in these images should be one a recipe could use.

The glasshouse opens in **the visitor's real season** (spring in Auckland in October, autumn in
Edinburgh), and a **seasons wheel** by the garden door turns it to any other season. So, like the
kitchen's weather views, we need the same views in four seasons with identical framing.

Roles are the same as the earlier briefs: ChatGPT makes the concept frames, Claude builds the room
in Blender and renders it as 360° panoramas.

---

## The layout, from the floorplan

Read this before prompting, so you can check ChatGPT's images against it.

- A **long, narrow lean-to glasshouse** built against the sunny side of the Inn: about 1.8 m wide
  and 6.3 m long, with a sloping glass roof that rises to the house wall.
- **The house wall** (cream limewashed plaster, like the hallway) runs along one long side. In it
  is the **door from the Chiapothecary**, an old oak four-panel door like the hallway doors,
  with the same **brass dial** beside it.
- **Glass on the other three sides:** the long garden side, the **sea end** and the **lane end**.
  Through it: the herb and flower garden, the sea, the sky.
- A **garden door** in the middle of the long glass side opens onto the herb and flower garden.
  The **seasons wheel** is on a post or the frame beside it.
- Inside: timber staging (benches) along the glass, raised beds or big terracotta troughs on
  the floor, pots everywhere, an old brick or terracotta-tile floor, a wind chime by the garden door.

**One choice to make:** the storybook picture of the Inn's exterior has **sage-green** glazing bars,
while the glimpse of the glasshouse in the hallway concept (`art-inbox/inn-hallway/07-magic-door-glasshouse.png`)
has **white** ones. This brief asks for **sage green** to match the outside of the Inn. Change
the colour in Prompt G1 if you'd rather have white.

## The plants

Pick from this list so every plant earns its place in a recipe. Ask for a generous, lived-in mix,
not a neat display.

| Group | Plants |
|---|---|
| **Calming and sleep** | chamomile, lavender, lemon balm, valerian, passionflower (climbing the roof) |
| **Digestion** | peppermint, spearmint, fennel, ginger and turmeric (in deep pots), lemon verbena |
| **Immunity and colds** | echinacea, elderflower (a shrub just outside), thyme, sage, holy basil (tulsi) |
| **Skin and beauty** | calendula, rose (with hips in autumn), aloe vera (in pots), marshmallow, cornflower |
| **Everyday wellness** | rosemary, nettle (in a contained bed), dandelion, borage, yarrow, hibiscus (in a pot, it likes the warmth) |

## What to bring back

Save into `whiskedaway-react/art-inbox/glasshouse/`:

| File | What |
|---|---|
| `01-to-garden-door.png` | Main view: across the glasshouse to the garden door and seasons wheel (the **season master**) |
| `02-to-sea-end.png` | Along the glasshouse to the glass sea end |
| `03-to-lane-end.png` | Along the glasshouse to the glass lane end |
| `04-house-wall-door.png` | The house wall, with the Chiapothecary door and its brass dial |
| `05-roof.png` | Looking up at the glass roof and the passionflower |
| `06-staging-closeup.png`, `07-pots-closeup.png` | Close-ups: the staging with seedlings and tools, a cluster of pots |
| `08-materials-moodboard.png` | Materials and palette board |
| `09-season-spring.png` … `12-season-winter.png` | The season master in all four seasons (see Prompt G3) |
| `13-outside-spring.png` … `16-outside-winter.png` | The view outside the glass in each season (see Prompt G4) |
| `17-seasons-wheel-flat.png` | The seasons wheel, flat and front-on (texture) |
| `18-seed-packets-flat.png`, `19-plant-labels-flat.png` | Flat artwork (see Prompt G5) |

Also paste ChatGPT's **props and materials list** (Prompt G6) into `art-inbox/glasshouse/notes.md`.
It becomes the Blender shopping list.

**Attach these three images** at the start of the conversation, as the look reference:
`art-inbox/cuddlecore/01-front-wall.png`, `art-inbox/cuddlecore/09-materials-moodboard.png` and
`art-inbox/inn-hallway/07-magic-door-glasshouse.png`.

## Prompt G1: look lock (paste first, with the three images attached)

> I'm art-directing a photoreal 3D environment for a cooking website called WhiskedAway. The
> site is an old countryside inn on a headland above the sea, and each room is one visitors can
> look around in 360°. The attached images are from rooms already built: the Cuddlecore Kitchen
> and the Inn's hallway, including a glimpse of the glasshouse through a door. We're now making
> **the glasshouse itself**, in the same building. We'll build it in Blender; your images are
> the **concept frames** that define the look. Please lock this in for every image in this
> conversation:
>
> - **Photographic realism**, matching the attached images: like a photograph for a gardening
>   or cosy-living magazine. Real plants with real untidiness: a few yellow leaves, soil on the
>   staging, worn terracotta with white mineral marks. Not CGI-glossy, not illustration.
> - **Camera:** full-frame, 24mm lens, eye level (about 1.6 m), level verticals, f/4 with
>   everything reasonably sharp. 16:9 landscape unless I say otherwise.
> - **Light:** a soft morning: low sun coming through the glass, gentle shadows of the glazing
>   bars across the floor and benches, a little condensation high on the glass.
> - **The structure:** an old Victorian-style lean-to glasshouse on the sunny side of the inn,
>   about 1.8 m wide and 6.3 m long. Slender timber glazing bars painted **soft sage green**,
>   slightly flaking. Sloping glass roof rising to the inn's cream limewashed wall. Old brick or
>   worn terracotta-tile floor. Weathered timber staging along the glass.
> - **Palette:** cream plaster (#f4efe4), sage green, terracotta, honeyed timber, aged brass
>   (#b07f52), and the colours of the plants.
> - **Never include:** people, text, readable labels, numbers, logos, watermarks, plastic pots,
>   modern fittings (hoses, sprinklers, electric heaters, screens).
>
> Reply with a short summary of the look. Don't make an image yet.

## Prompt G2: the glasshouse views

> Here is the layout. The glasshouse is long and narrow and runs along the inn's sunny side.
> One long side is the inn's cream plaster wall, with an old oak four-panel door into the
> apothecary still-room and a round brass dial beside the door at chest height (the same dial
> as in the attached hallway images). The other three sides are glass: the long garden side,
> the end facing the sea, and the end facing the village lane. A glazed **garden door** sits in
> the middle of the long garden side, and beside it, on the door post, a round **seasons wheel**:
> brass and old timber, about 30 cm across, with four blank plates and a handle to turn it.
> A small wind chime hangs by the garden door.
>
> It is full of **medicinal, health and beauty plants**, all growing well and a little untidy:
> chamomile, lavender, lemon balm, peppermint, fennel, ginger and turmeric in deep pots, echinacea,
> thyme, sage, holy basil, calendula, aloe vera, rosemary, borage, a pot of hibiscus, and a
> passionflower climbing up under the roof. Seedlings in trays and old tools on the staging.
> Bunches of herbs drying from a beam along the house wall.
>
> First: standing with your back to the inn's wall, **looking across to the garden door** and
> the seasons wheel, with the garden and a strip of sea visible through the glass beyond.

Then, in the same conversation:
- "Now **along the glasshouse to the sea end**: the glass end wall with the sea beyond it. Same
  light, same moment."
- "Now **the other way, to the lane end**: glass end wall, the garden and the village lane beyond."
- "Now **the inn's wall**: the oak door into the apothecary still-room, the brass dial beside
  it, the drying herbs above, pots along the foot of the wall."
- "Now **looking up at the glass roof**: the sage-green glazing bars, the passionflower trained
  along them, a little condensation, morning sky."
- "Close-up of the staging: seedling trays, a trowel, twine, a few cut stems ready for the
  kitchen. Shallow depth of field." Then the same for "a cluster of terracotta pots of different
  sizes, mixed herbs in them".
- "A materials moodboard for the glasshouse: swatches of the sage-painted timber, the old glass,
  the brick or tile floor, terracotta, the staging timber, potting soil, twine, the brass of the
  dial and seasons wheel, on a linen background, photographed from above."

## Prompt G3: the four seasons (the most important set)

Visitors see the glasshouse in their own season, and can turn the seasons wheel to see the others.
**The framing must be identical in every version:** same camera, same glazing bars, same garden
door, same staging and beds, all in exactly the same place, so the images can cross-fade without
anything jumping. Only the plants, the light and the view outside change. Start from the first
view (`01-to-garden-door.png`) each time:

> "Now the **exact same view as the first image**: identical composition, glazing bars, garden
> door, seasons wheel, staging, pots and beds, nothing moved, but in [season]."

| File | Season | [season] |
|---|---|---|
| `09-season-spring.png` | Spring | "**spring**: fresh new growth everywhere, trays of seedlings, chamomile and calendula just coming into flower, mint and lemon balm bright green, blossom on a fruit tree outside, cool clear morning light" |
| `10-season-summer.png` | Summer | "**summer**: everything at its fullest, lavender, echinacea, borage and calendula in full flower, passionflower blooming under the roof, bees, warm golden light, the garden door propped open" |
| `11-season-autumn.png` | Autumn | "**autumn**: rose hips and elderberries outside, echinacea gone to seed heads, ginger and turmeric being lifted from their pots, more herbs drying from the beam, low amber light, a few fallen leaves on the floor" |
| `12-season-winter.png` | Winter | "**winter**: the evergreen herbs (rosemary, thyme, sage) and the aloe carrying the glasshouse, other pots cut back and resting, frost on the outside of the glass, bare garden outside, pale low sun" |

**Check alignment** the same way as the weather views: flick between two seasons. If the garden
door, the wheel or the staging moves, ask: "The composition shifted. Redo it matching the first
image exactly."

## Prompt G4: the view outside the glass, in each season

Claude builds the glass in 3D, so the view outside needs to be its own image, placed a few
metres beyond the glass in Blender:

> "Now the **view outside the glasshouse**, with no glass, glazing bars or glasshouse in shot:
> the herb and flower garden with a low stone wall, an elder shrub, the sea beyond, and the sky.
> The widest landscape format you can make (21:9 or wider). Standing at ground level, eye height
> about 1.6 m, level horizon about 45% of the way up. In [season], the same seasons as before."

Save as `13-outside-spring.png`, `14-outside-summer.png`, `15-outside-autumn.png`,
`16-outside-winter.png`. The framing must be identical across all four, as with the seasons above.

## Prompt G5: flat artwork (used as textures inside the 3D room)

- "**The seasons wheel on its own, for use as a texture**: perfectly front-on, perfectly
  circular, no perspective, filling a square image. Even soft light, plain neutral background.
  Brass rim, timber centre, four **blank** plates at 12, 3, 6 and 9 o'clock, and a small engraved
  leaf between each pair. **Leave the handle off.**"
- "**A sheet of six old seed packets**, flat and front-on, laid out in a grid on a plain
  background: kraft and cream paper, each with a small botanical illustration of a different
  plant (chamomile, calendula, lavender, echinacea, borage, mint), **no lettering at all**."
- "**A set of eight plant labels**, flat and front-on: old slate and wooden labels of different
  shapes, **blank**, laid out on a plain background."

**Why blank:** AI images garble lettering. Claude adds the season names to the wheel and the
plant names to the labels in Blender, so they're crisp and spelled right. If ChatGPT adds any
letters, ask: "Same image, but with every plate and label completely blank."

## Prompt G6: the Blender shopping list

> Looking at all the images we made, write a props and materials list I can use to build this
> glasshouse in Blender. Group it as: **structure** (glass walls, roof, glazing bars, the house
> wall, the floor, the garden door); **doors and wheels** (the Chiapothecary door and its dial,
> the seasons wheel, with sizes); **furniture** (staging, beds, troughs, the drying beam);
> **plants** (each plant, where it grows, rough size, and how it looks in each season);
> **set dressing** (pots, tools, trays, the wind chime); **materials** (each with colour,
> roughness and how worn); **lighting** (the sun in each season, colour temperature, rough
> brightness). Mark anything that's essential to the mood with ★.

**Keep pushing on:** realism ("less tidy, more lived-in: soil, yellow leaves, chipped pots"),
plant accuracy ("that isn't chamomile: chamomile has small white daisy flowers with yellow centres"),
and the season set ("nothing may move between seasons except the plants and the light").

---

## Checklist

- [ ] It looks like the same Inn as the kitchen and hallway: same plaster, same oak door, same dial
- [ ] Glass on three sides, the cream house wall on the fourth, the garden door in the long glass side
- [ ] Every plant is from the list, and recognisable
- [ ] The four season images line up exactly when you flick between them
- [ ] The four outside views line up exactly too
- [ ] The seasons wheel, seed packets and plant labels are completely blank
- [ ] No people, and no readable text or garbled lettering anywhere
