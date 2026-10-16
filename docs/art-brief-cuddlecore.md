# WhiskedAway: art brief for ChatGPT (#1, Cuddlecore Kitchen + Gemma)

**Goal:** replace the flat SVG shapes in the Inn with painted illustrations, so the site stops
feeling like a prototype. ChatGPT paints the scenes. Claude places them in the code and lines the
clickable hotspots up with whatever ChatGPT draws.

**Start with:** the Cuddlecore Kitchen background and a Gemma character sheet. Once the style is
locked, the other five kitchens and the Inn hallway reuse the same style prompt.

---

## How the art gets used (read this before prompting)

- **One painted background per kitchen**, shown full-screen behind the UI. Visitors click
  objects in the painting (the jars, the candles, the pot…), and each one opens a small form panel.
- **The painting is the interface.** Every clickable object has to be clearly separate and easy to
  spot, and nothing can overlap it. A pretty but cluttered painting will fail.
- **Don't chase exact positions.** ChatGPT is bad at placing things precisely, and it doesn't need
  to. Claude measures where each object ended up and moves the hotspots to match. Just make
  sure every required object is in the painting and easy to see.
- **No text in the images.** No labels, signs, book titles or jar labels with lettering. ChatGPT's
  text comes out garbled, and the UI adds real labels anyway.
- **No people in the backgrounds.** Gemma is a separate image placed on top.

## Technical spec

| | |
|---|---|
| Aspect ratio | **16:9 landscape** (ask for 1792×1024 or the widest landscape option, then upscale if needed) |
| Format | PNG |
| Safe zone | Keep every clickable object inside the **middle 80% horizontally and the top 80% vertically**. Phones and narrow windows crop the edges. |
| Background | Full opaque painting (no transparency) |
| Gemma | Separate PNG, **transparent background**, full body, about 1024 tall |

Save files into `whiskedaway-react/art-inbox/` (Claude will move them into `src/assets/`):

```
cuddlecore-bg-v1.png, cuddlecore-bg-v2.png …
gemma-idle-v1.png, gemma-talking-v1.png, gemma-thinking-v1.png
```

---

## Prompt 1: style lock (paste this first, in a fresh ChatGPT conversation)

> I'm art-directing a set of illustrations for a cosy cooking website called WhiskedAway. The
> whole site is a magical old inn, and each room is a different kitchen. A kind kitchen genie
> called Gemma helps visitors work out what to eat based on how they feel. Every image we make in
> this conversation should share one consistent style. Please lock it in:
>
> - **Medium:** hand-painted storybook illustration in soft gouache and watercolour, with visible
>   brush texture, gentle edges, and no hard vector outlines. It should feel warm and handmade,
>   not 3D-rendered, not photographic, and not flat vector.
> - **Mood:** cosy, safe, unhurried. Like a rainy afternoon wrapped in a blanket.
> - **Light:** warm candle and lamp light, soft long shadows, slight golden haze. Cool blue-grey
>   daylight from windows as a contrast.
> - **Base palette:** parchment cream (#f4efe4), warm amber (#c4956a), honey glow (#e8b87a),
>   deep ink brown (#2c2416), aged wood browns. Each kitchen adds one accent colour.
> - **Camera:** straight-on, eye-level view into the room, like a stage set or a dollhouse cut-away.
>   Wide 16:9. No dramatic perspective, no fisheye.
> - **Readability:** the room's important objects must be distinct, uncluttered, and easy to
>   pick out at a glance, because visitors will click on them.
> - **Never include:** any text, letters, numbers or labels; people or characters (unless I ask);
>   logos; watermarks; borders.
>
> Reply with a one-paragraph summary of the style so we can refer back to it. Don't make an
> image yet.

## Prompt 2: Cuddlecore Kitchen background

> Using our locked style, paint the **Cuddlecore Kitchen**: the softest, most comforting room in
> the inn, for someone who's unwell, exhausted, or just having a hard day. Accent colour: dusty
> berry (#8b4d5c) in curtains, a knitted blanket and ceramic jars.
>
> Straight-on view of the back wall, 16:9 landscape. It's raining outside. These objects must all
> be clearly visible, separate from each other, and not overlapping. **Each one is something
> visitors click:**
>
> 1. **A shelf of glass and ceramic jars** (upper left area): five or six jars with cork or cloth
>    lids, some berry-tinted. No writing on them.
> 2. **Three candles of different heights** (upper left-centre): short, medium and tall, lit and
>    clearly separate. They represent how much energy you have.
> 3. **A small hand-drawn map pinned to the wall** (top centre, above or beside the window). It
>    should be small, with no readable text.
> 4. **A rain-streaked window** (centre) with soft berry curtains. This is decoration, not clickable.
> 5. **A bookshelf of well-loved cookbooks and recipe cards** (upper right-centre). No titles on
>    the spines.
> 6. **A tall wooden pantry cupboard** (right side) with its doors slightly ajar and a warm glimpse
>    of food inside.
> 7. **A big cast-iron pot simmering on a small stove** (centre, lower half). **This is the hero
>    object.** It's the most prominent thing in the room, with gentle steam curling up. Clicking it
>    "cooks" the recipe.
> 8. **A small wooden door** at the far left edge, leading back to the inn hallway.
>
> Fill the lower third with something cosy rather than bare floor: a worn rug, an armchair with
> a berry-coloured knitted blanket, perhaps a sleeping cat curled on a cushion. Leave a clear,
> uncluttered spot on the floor to the **right of the pot**, about one-sixth of the image wide.
> Gemma will be placed standing there later.

**Iterate in the same conversation.** Useful follow-ups:
- "Make the pot bigger and more central; it's the main thing people click."
- "The candles are blending into the window. Separate them and give them more contrast."
- "Too busy. Remove the small clutter between the objects and keep only the numbered items."
- "Same scene at dusk, rain heavier, candlelight stronger." (A night variant is a nice later touch.)

## Prompt 3: Gemma character sheet

> Using our locked style, design **Gemma, the kitchen genie** who runs the inn's kitchens. Full
> body, standing, facing the viewer, on a **transparent background**.
>
> She's a warm, quietly funny host who's seen every kind of bad day and always has soup on. She
> could be anywhere from her 30s to her 50s: kind eyes, an easy smile, a little mischief.
> She wears a practical apron over soft layered clothes, sleeves rolled up, with a tea towel over
> one shoulder. Her genie magic shows up as a soft swirl of warm, steam-like mist around her feet
> and a faint golden glow at her fingertips. **Please avoid "Arabian Nights" costume clichés**
> (no harem pants, bra tops, turbans or lamps). She's a genie of the kitchen, not a fantasy
> stereotype.
>
> Keep the design simple enough to read at small sizes (she'll often appear only 150px tall), with
> a distinctive silhouette and colours that stand out against warm wood and cream walls.

Then, **in the same conversation** so she stays consistent:
- "Same Gemma, same outfit, **talking**: one hand gesturing warmly, mouth open mid-sentence."
- "Same Gemma, **thinking/cooking**: stirring a wooden spoon in the air, mist swirling, eyes half-closed." (shown while recipes load)
- "Same Gemma, **head-and-shoulders portrait**, circular crop friendly." (used as the small avatar)

> **Nicole to decide:** what Gemma looks like is a brand decision. The current emoji (🧞‍♀️) has
> no real identity yet. Generate a few versions before choosing.

---

## Review checklist (before handing art back)

- [ ] All 8 required objects present and easy to find in under 3 seconds
- [ ] No garbled text anywhere (zoom in on jars, books and the map)
- [ ] The pot is clearly the focal point
- [ ] Nothing important in the outer 10% of the left and right edges
- [ ] A clear floor spot for Gemma
- [ ] Gemma: no extra fingers, the transparent background really is transparent, consistent across poses

## What Claude does with it

1. Replace the SVG in `src/scenes/environments/CuddlecoreKitchen.jsx` with the painting.
2. Fix hotspot alignment: put the painting and the hotspots in one fixed 16:9 "stage" so the
   icons stay on their objects at every window size. Today they drift, because the SVG crops but
   the hotspots don't.
3. Re-measure the hotspot boxes in `src/scenes/sceneData.js` against the painting.
4. Swap Gemma's emoji for the illustrated poses (idle, talking while she speaks, thinking while
   loading).
5. Optional: a subtle parallax layer (steam and rain over the painting) so it feels alive.

## After Cuddlecore

Same style-lock conversation, one prompt per room: **Flourish** (golden #d4a84b, sunny
greenhouse kitchen), **Cravings Decoded** (purple #7c5c8b, mysterious fortune-teller pantry),
**Sweet Spells** (rose #c27a8c, bakery), **Chiapothecary** (herb green #5c7c5c, potion lab),
**Nourish Academy** (teal #4a7c7c, library-classroom kitchen), and the **Inn hallway** with six
doors. Claude will draft each room's object list from its hotspots when we get there.
