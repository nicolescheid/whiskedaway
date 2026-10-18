# WhiskedAway: ChatGPT brief #8, the Chiapothecary

**The Chiapothecary** is the chia pudding tome: "chia pudding experiments with superpower vibes".
Visitors pick a superpower (energising, calming, indulgent, refreshing, warming, tropical) and a
base (creamy, light, rich), and Gemma brews it.

Nicole's picture of the room (18 October 2026): **an old apothecary shop, like a traditional
Chinese herbal medicine store**, with walls of small wooden drawers and jars of exotic ingredients,
except every ingredient is for chia puddings. A **vintage refrigerated display cabinet** holds the
milks and the set puddings. The room's instrument is the **clockwork songbird**.

Roles are the same as the earlier briefs: ChatGPT makes the concept frames, Claude builds the room
in Blender and renders it as 360° panoramas.

---

## The layout, from the floorplan

- **Where:** ground floor, at the front of the Inn (the village lane side), on the sunny side.
  Across the hallway from Sweet Spells, and in front of Flourish.
- **Size:** about 4.5 m × 4.5 m, with the Inn's beams, limewashed plaster and wide floorboards
  showing where the shop fittings don't cover them.
- **Hallway wall:** the old oak four-panel door back to the hallway, usually left a little ajar.
- **Garden wall:** a **glazed door into the glasshouse**, with green light and plants beyond it.
  Claude builds the glasshouse in 3D, so the view through this door is the real glasshouse.
- **Front wall:** a small-paned **shop window onto the village lane**. The view of the lane comes
  from the Sweet Spells brief (#9), which makes one wide lane view for both front rooms.
- **Back wall:** an inside wall (Flourish is on the other side).

## What's in it

These are what visitors click, so each must be distinct and uncluttered:

- **The hero: the wall of drawers.** A tall cabinet of dozens of small wooden drawers, each
  with a small brass pull and a **blank** label plate, the kind found in an old herbal pharmacy.
  A few drawers open, showing chia seeds (black and white), coconut flakes, cacao nibs, goji
  berries, dried mango, freeze-dried raspberries, cinnamon bark, cardamom, vanilla pods, matcha.
- **The counter:** a long, worn wooden shop counter with **brass hand scales**, a stone mortar
  and pestle, paper parcels tied with string, and a row of glass jars of chia pudding in layers
  (berry, mango, matcha, chocolate) being made.
- **The fridge:** a **vintage glass-fronted refrigerated display cabinet**, 1950s style, enamel and
  chrome, softly lit inside. Glass bottles of different milks (oat, almond, coconut, soy, dairy)
  and jars of finished puddings on its shelves. The one modern-ish thing in the Inn, and it should
  look like it has been there for seventy years.
- **The clockwork songbird:** a small brass bird in a round brass cage, on the counter or hanging
  near the glasshouse door. The room's instrument.
- **Bubbling flasks:** two or three glass flasks on a stand, a soft infusion bubbling (fruit
  tea, a chai), for the "experiment" feeling.

**Accent colour: herb green (#5c7c5c)** in the cabinet paint and the jar lids, with the warm
red-brown of old lacquered wood. If you'd rather a different accent, change it in Prompt C2.

**Respect the source.** The look borrows from traditional Chinese herbal pharmacies, so it should
feel like a real, well-loved old shop, not a theme-park pastiche: no lanterns-and-dragons
decoration, no fake calligraphy, no characters or writing of any kind on the drawers or signs.

## What to bring back

Save into `whiskedaway-react/art-inbox/chiapothecary/`:

| File | What |
|---|---|
| `01-drawers-counter.png` | Main view: the wall of drawers behind the counter (the **composition master**) |
| `02-fridge.png` | The vintage display fridge and its milks and puddings |
| `03-glasshouse-door.png` | The garden wall: the glazed door into the glasshouse, the songbird nearby |
| `04-shop-window.png` | The front wall: the shop window onto the lane |
| `05-hallway-door.png` | The hallway wall and the oak door, a little ajar |
| `06-drawers-closeup.png`, `07-counter-closeup.png`, `08-songbird-closeup.png` | Close-ups |
| `09-materials-moodboard.png` | Materials and palette board |
| `10-label-plates-flat.png`, `11-paper-parcel-flat.png`, `12-tile-floor-candidate.png` | Flat artwork (Prompt C4) |

Also paste ChatGPT's **props and materials list** (Prompt C5) into `art-inbox/chiapothecary/notes.md`.

**Attach these images** at the start of the conversation:
`art-inbox/cuddlecore/01-front-wall.png`, `art-inbox/cuddlecore/09-materials-moodboard.png`,
`art-inbox/inn-hallway/02-hallway-to-sea.png` and `art-inbox/glasshouse/01-to-garden-door.png`
(the glasshouse it opens onto).

## Prompt C1: look lock (paste first, in a fresh conversation, with the images attached)

> I'm art-directing a photoreal 3D environment for a cooking website called WhiskedAway. The
> site is an old countryside inn on a headland above the sea, and each room is one visitors can
> look around in 360°. The attached images are from rooms already designed: the Cuddlecore
> Kitchen, the inn's hallway, and the glasshouse. We're now making **the Chiapothecary**, in the
> same building. We'll build it in Blender; your images are the **concept frames** that define
> the look. Please lock this in for every image in this conversation:
>
> - **Photographic realism**, matching the attached images: like an interiors photograph for a
>   magazine. Real materials, real light, natural wear: rubbed brass, worn drawer fronts, old
>   glass, paper and string. Not CGI-glossy, not illustration.
> - **Camera:** full-frame, 24mm lens, eye level (about 1.6 m), level verticals, f/4 with the
>   whole room reasonably sharp. 16:9 landscape unless I say otherwise.
> - **Light:** a bright late morning. Green-tinted daylight coming through the glasshouse door,
>   softer light from the shop window, a warm glow from inside the display fridge.
> - **Era and place:** the same lived-in countryside inn: timber beams, cream limewashed
>   plaster, worn floorboards, fitted out long ago as an old apothecary shop.
> - **Base palette:** cream plaster (#f4efe4), honeyed oak, aged brass (#b07f52), deep brown
>   (#2c2416), plus this room's accent (I'll give it next).
> - **Never include:** people, text, readable labels, characters or calligraphy, numbers, logos,
>   watermarks, plastic, or screens.
>
> Reply with a short summary of the look. Don't make an image yet.

## Prompt C2: the Chiapothecary views

> Using our locked look: **the Chiapothecary**, an old apothecary shop inside the inn, modelled
> on a traditional Chinese herbal medicine store, but every ingredient in it is for making
> **chia puddings**. It feels like a place for playful experiments. Accent colour: **herb green
> (#5c7c5c)** on the cabinet and jar lids, with warm red-brown lacquered wood. Make it feel like a
> real, well-loved old shop, not a themed set: no lanterns, dragons or writing anywhere.
>
> The room is about 4.5 m × 4.5 m:
>
> - **Back of the shop:** a tall **cabinet of dozens of small wooden drawers** with brass pulls
>   and **blank** brass label plates. A few drawers pulled open: black and white chia seeds,
>   coconut flakes, cacao nibs, goji berries, dried mango, freeze-dried raspberries, cinnamon
>   bark, cardamom pods, vanilla pods, matcha powder. Glass jars on the cabinet's top shelf.
> - **In front of it, a long worn wooden shop counter:** brass hand scales, a stone mortar and
>   pestle, paper parcels tied with string, and a row of small glass jars of **layered chia
>   pudding** (berry, mango, matcha, chocolate) part-way through being made. Two or three glass
>   flasks on a stand, a fruit tea gently bubbling.
> - **One side wall:** a **vintage 1950s glass-fronted refrigerated display cabinet**, cream
>   enamel and chrome, softly lit inside, with glass bottles of oat, almond, coconut, soy and
>   dairy milk and jars of finished puddings on its shelves. It should look seventy years old.
> - **The other side wall:** a **glazed door into a glasshouse**, green with plants (match the
>   attached glasshouse image). Hanging near it, a **small brass clockwork songbird in a round
>   brass cage**.
> - **Front wall:** a small-paned **shop window** onto a village lane.
> - **Hallway wall:** an old oak four-panel door, a little ajar, like the one in the attached
>   hallway image.
>
> First: standing in the middle of the shop, **looking across the counter to the wall of
> drawers**.

Then, in the same conversation:
- "Now **the display fridge**, its milks and puddings, the counter's end in the foreground. Same light, same moment."
- "Now **the glazed door into the glasshouse**, with the songbird's cage nearby."
- "Now **the shop window** onto the lane (keep the view outside soft; Claude will replace it)."
- "Now **the hallway wall** with the oak door a little ajar."
- "Close-up of the open drawers, shallow depth of field." Then the same for "the counter with
  the scales, the parcels and the layered chia jars", and "the clockwork songbird in its cage".
- "A materials moodboard for this room: swatches of the drawer wood, the herb-green paint, brass,
  old glass, cream enamel and chrome from the fridge, kraft paper and string, stone, chia seeds,
  on a linen background, photographed from above."

## Prompt C3: the songbird

The songbird is the room's instrument (visitors wind it and it sings), so Claude needs to see it clearly:

> "The **clockwork songbird** on its own, side view and three-quarter view: a small brass bird,
> about the size of a sparrow, with fine engraved feathers and a tiny winding key, on a perch
> inside a round brass cage with a domed top. Plain background, even light, no text."

## Prompt C4: flat artwork (textures inside the 3D room)

- "**A set of twelve blank brass label plates** for the drawers, flat and front-on, slightly
  worn, on a plain background. **No lettering at all.**" Claude adds the ingredient names in Blender.
- "**A flat sheet of kraft paper with a printed botanical pattern** of chia flowers and leaves,
  for the wrapped parcels, top-down, evenly lit, square, tileable, no text."
- "**A seamless tile pattern for the shop floor**: old encaustic tiles in herb green, cream and
  terracotta, top-down, evenly lit, square, tileable." Claude will decide between tiles and floorboards.

## Prompt C5: the Blender shopping list

> Looking at all the images we made, write a props and materials list I can use to build this
> room in Blender. Group it as: **structure** (walls, beams, floor, the shop window, the
> glasshouse door, the hallway door, with sizes); **furniture** (the drawer cabinet with the
> number of drawers, the counter, the display fridge, shelves); **hero objects** (the drawers,
> the counter setting, the fridge contents, the songbird and cage, the flasks); **set dressing**;
> **materials** (each with colour, roughness and how worn); **lighting** (daylight from the
> glasshouse and the window, the fridge's inner light, colour temperature, rough brightness).
> Mark anything that's essential to the mood with ★.

**Keep pushing on:** authenticity ("more like a real old shop, less like a film set"),
realism ("more wear on the drawer fronts, a few seeds spilt on the counter"), and readability
("the songbird is getting lost; give it some space and light").

---

## Checklist

- [ ] It looks like the same Inn: same beams, plaster, oak door
- [ ] It reads as an old apothecary shop for chia puddings, not a themed set
- [ ] The drawers, counter, fridge and songbird are each easy to pick out
- [ ] The glazed door opens onto the glasshouse; the shop window is on the front wall
- [ ] Every label plate is blank; no writing, characters or calligraphy anywhere
- [ ] No people
