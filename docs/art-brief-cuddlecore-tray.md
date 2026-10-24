# Art brief: Cuddlecore's tray of feels, the little cage and the bell jar

For the art session, via the PM. Written 24 Oct 2026 by the tray builder. Nicole's decisions are from 23 Oct
(cuddlecore-medicine-foods.md in the PM (4) notes folder). The code is built and works on placeholder hotspots.
This brief covers the three objects that need to be rendered into Cuddlecore. One render pass does all three, in every
weather, by day and night, like the room's other re-renders.

## What they're for

- **The tray of feels**: tap it and the "How you like it" sheet opens. Visitors say Skip it, Either way or More, please
  for each feel: spicy heat, strongly spiced, strong flavours, strong smells, bitter, very sour, coriander, slippery,
  very crunchy, bits in smooth things, seeds and pips, nuts, skins and husks.
- **The little cage**: whatever the visitor skips appears inside it, drawn by the page over the render the way the
  candle flames are. Gemma's line is "Locked up. It can't get you in here." Tap the cage to let something out.
- **The bell jar**: a glass cloche holding the foods some medicines don't get on with: grapefruit, liquorice, a wedge of
  aged cheese, a small bottle of cooking wine, a bunch of leafy greens. **The feature is switched off on the live site**
  until a pharmacist or dietitian has checked it, so the render has to look right with nothing interactive about it
  (see "The tag" below).

## Where (Cuddlecore's 360°, yaw/pitch as in out/cuddlecore_hotspots.json)

The placeholders use spots that are free in today's render. Art can move them. When you do, update the yaw/pitch in
`out/cuddlecore_hotspots.json` (art's file), and the code follows.

| Object | Placeholder spot | Where in the room | Hotspot id |
|---|---|---|---|
| Tray of feels | yaw 19.5, pitch -11.5 | the left end of the distressed white dresser, to the right of the window, left of the soup bowl | `feels-tray` |
| Little cage | yaw 67, pitch 12.5 | the top shelf of the white hutch (the pantry cabinet) | `cage` |
| Bell jar | yaw 112, pitch 13 | the top shelf on the right wall, beside the white jug, above the cookbooks (the dietary shelf) | `bell-jar` |

Keep each object clear of its neighbours' hotspots (the bowl at 27.5/-9.8, the oil lamp at 38.5/-3.7, the pantry
cabinet at 64.3/-11.9, the dietary shelf at 104.5/2.9), so the dots don't crowd.

## How they look

The Inn's style throughout: warm, lived-in, slightly worn, nothing new or shiny. They're Gemma's own things.

- **Tray of feels**: a small, worn wooden serving tray (about 35 × 25 cm) with a low rim and two cut-out handles.
  On it, little dishes and saucers, one per feel where it can be shown: a red chilli; a few whole spices (a cinnamon
  stick, star anise); a slice of okra; a mushroom; a lemon wedge; a sprig of coriander; a crisp or a pretzel; a pinch
  of seeds; a few nuts in their shells; a curl of potato skin. Bright and readable at phone size, not a jumble: five
  to seven small dishes in a loose grid. No labels.
- **Little cage**: a small domed wire birdcage (about 25 cm tall) in aged brass or black iron, with a ring at the top.
  Its little door is **slightly open** (you can let things out). **Leave the inside empty and evenly lit**: the page
  draws small tokens of the skipped feels inside it (a chilli, a sprig of coriander, a few seeds), so it needs clear
  space behind the bars with nothing busy behind them. A plain wall behind is ideal.
- **Bell jar**: a clear glass cloche on a round wooden base (about 30 cm tall), on the shelf. Inside: half a
  grapefruit, a small liquorice tin (plain, with no brand), a wedge of hard aged cheese, a little bottle of cooking wine,
  and a small bunch of leafy greens. The glass should catch a highlight, so it reads as glass at phone size.
  **No label on the glass, and no tag in the render** (see below).

## The tag on the bell jar

Nicole wants a small hand-written tag, "Keeping off?". The feature ships switched off, so a painted tag would ask a
question the page can't answer yet. So:

- the render shows the jar as an ordinary still life (it reads as "set apart", not "for sale");
- the page draws the tag as an overlay, like the cage's tokens, only when the feature is switched on. The page's tag is
  a stand-in. If art wants to paint a nicer one, make it a separate transparent PNG (a brown paper tag on string,
  "Keeping off?" in a hand-written style, about 512 × 256), and the page will use it.

## What the page needs back from art

1. The renders, as usual (all weathers, day and night, previews and phone tier).
2. `out/cuddlecore_hotspots.json`: `feels-tray`, `cage` and `bell-jar` at their final yaw/pitch, `"type": "interactive"`.
   For the cage, add an `inside` point at the middle of the cage's empty space, with its distance in metres, like a
   candle's `flame`: `"inside": { "yaw": 67.0, "pitch": 12.0, "distance": 2.4 }`. The tokens are drawn there, sized for
   the distance.
3. Tell the PM once the cage is painted. The page draws a stand-in wire cage until then, and one constant in
   `explore/how-you-like-it.js` (`CAGE_PAINTED`) switches it off.
4. The painted teleporter dials can go in the same pass (Inn map, 24 Oct), as already planned.

## Not in this pass

- No text in the renders (no labels, no tag).
- Nothing that suggests health or medicine: no pill bottles, no pharmacy look.
