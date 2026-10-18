# WhiskedAway — Flourish kitchen: Blender shopping list

★ marks the details essential to the mood. Flourish is the Inn's bright, busy morning kitchen: fresh garden food on a scrubbed pine table, marigold linen, warm low sunlight and room to get going. Keep the cream plaster, old oak, beams and wide floorboards in the same family as Cuddlecore and the hallway.

## Build decisions and layout

- Footprint **about 4.5 × 4.5 m**. All other dimensions here are practical blockout proposals, not measurements extracted from generated photographs.
- Local x runs from hallway/west (0) to garden/east (4.5); y runs from front/Chiapothecary/south (0) to sea/north (4.5). Floor z=0.
- ★ **North/sea:** one large timber sash window and sunny ledge with three herb pots. Keep adjacent plaster clear for later Inn-wide controls.
- ★ **East/garden:** one stable door, lower leaf closed and upper leaf open in the concepts. The vegetable trug sits beside it, outside the door's working clearance.
- **West/hallway:** four-panel oak door in the front half; range and hood in the sea half. The brief leaves the range wall unspecified; this placement preserves the sea window, garden exit and dresser wall.
- **South/front:** tall painted dresser; separate little phonograph table at its west end. Chiapothecary is on the other side of this solid inside wall; do not add another connection.
- ★ Central pine table is the main interactive hero. The phonograph, trug, range and dresser must have separate visible silhouettes and reachable click areas.
- **01** governs the room's material, light and table identity. **03** governs the range; **04** the dresser and phonograph location; **07** the instrument details; **08** the wooden trug. The written plan and layout.json resolve small perspective/scale differences between generated wall photographs.
- **13 is intentionally unused.** Filenames 14–23 match Cuddlecore's weather and night numbering.

## Structure

| Item | Size / build direction |
| --- | --- |
| ★ Walls | Cream limewash #f4efe4; approximately 2.7 m high. Soft waviness, fine plaster, lightly worn corners and lower edges. |
| ★ Beams | Reuse Inn beam family, roughly 140–180 mm wide ×180–220 mm deep; softened oak edges, dark old tool marks, restrained wear. |
| ★ Floor | Wide old boards roughly 200–280 mm, honey-brown with darker seams and irregular scuffs. No glossy laminate finish. |
| Sea window | Timber double sash, roughly 1.85 ×1.45 m opening, sill about0.925 m; six main lights matching 01. Painted cream frame, aged brass latch; build real glazing in3D. |
| Sunny ledge | About330 mm deep below sea window, honey timber top. Three small clay herb pots; leave most view clear. |
| ★ Stable garden door | About900 ×2050 mm, horizontal split at~1.03 m. Old cream-painted timber, dark iron strap hinges, old knob/latch. Lower leaf closed, upper open; use separate meshes/pivots. Match panel proportions in01/02. |
| Hallway door | About850 ×2000 mm, honey oak, **four recessed panels**, cream architrave, old brass knob. Reuse hallway door family. **No navigation dial on Flourish's inside face.** |
| Range hood / hearth wall | Shallow traditional plaster chimney hood on west wall above range; simple copper-pan rail below. No modern extractor controls or exposed contemporary ducting. |

The view angles are individual concept photographs, not registered faces of one panorama. Build one room from the fixed plan, then render all360 views from that shared geometry.

## Furniture

| Item | Proposed dimensions / placement |
| --- | --- |
| ★ Hero table | Scrubbed solid pine, about1.90 ×0.95 ×0.77 m. Central at x≈2.35,y≈2.5. Thick worn top, visible timber legs and apron. No cabinets or island plinth. |
| Chairs | Four mismatched old wooden chairs, seats~450 mm high. Plain spindle/ladder backs; keep a clear walk past each doorway. |
| ★ Range | Large vintage cream enamel solid-fuel range, about1.40 m wide ×0.70 deep ×0.90 high. Black iron top and door hardware, muted brass latch details. Use03 for front doors and proportions. |
| Small range counter | About450–600 mm of honey timber workspace beside range where the blockout allows. A plain utensil jug and boards, not a modern fitted-kitchen run. |
| ★ Dresser | Cream painted timber, about2.10 m wide ×0.54 deep ×2.20 high; honey worktop, open shelves, drawers and lower cupboards. On south/front wall. |
| ★ Phonograph table | Separate old timber side table at west end of dresser, about650 ×550 ×760 mm. Give crank and horn extra clearance; table should remain visible beneath case. |
| Window ledge | Timber ledge/low sunny seat. A simple ledge is selected in the concepts; avoid adding a large upholstered bench that blocks the table route. |
| Small rug | Restrained natural coir/jute runner near range/table as seen in room views; keep worn floorboards dominant. |

Aim for roughly800–900 mm clear circulation where possible; test actual chair bounds, door swing and clicking sightlines in Blender rather than trusting a wide-angle image.

## Hero objects

### ★ The table setting

Keep ingredients distinct rather than building a decorative feast:

- Chipped cream earthenware bowl of **brown eggs**, about220–260 mm diameter.
- One round crusty loaf, about280–320 mm, on a scarred wooden board roughly400 ×300 mm; simple bread knife.
- Separate generous wooden bowl/bunch of **kale, fresh greens and herbs** from the garden.
- Cream bowl of oats and mixed seeds, about220–280 mm.
- ★ Marigold/cream striped runner with a thin garden-green line. Approximate physical runner width380–450 mm; use11-runner-tile.png as repeating weave/pattern.
- Plain marigold jug, cream mugs and a few plates; keep each group readable.
- Modest crumbs, flour and a few oat flakes. These communicate a working kitchen without hiding the food.

### ★ Wind-up horn phonograph

Use07-phonograph-closeup.png as the detail authority. Walnut/oak case roughly400–450 ×350–400 ×180–220 mm; aged brass horn bell roughly350–450 mm across, total instrument height~650–800 mm above tabletop. A black record sits flat on a turntable with a coherent tonearm/soundbox/tube connection. A separate **side winding crank** projects~140–200 mm with a dark timber grip.

Build the winding crank as its own animated mesh with a clear click target. Keep horn and crank clear of jars, flowers and the wall. Record label and case badge stay blank; any chosen record lettering belongs in Blender.

### ★ Wooden vegetable trug

Use08-trug-closeup.png: a shallow oval **wooden Sussex-style trug**, broad curved solid timber slats, bent rim and one bentwood arch handle. **Not wicker or rattan.** Approximately500–600 ×300–380 mm, bowl180–220 mm deep, handle rising~300–400 mm. Soil-marked carrots with tops, beetroot, textured kale and green beans. A little loose soil on floor; no decorative flowers.

### Range and copper pans

One low heavy cast-iron frying pan~280–320 mm and old kettle~2–3 litres on black iron top. **Five** varied copper pans on a simple rail above, with dark handles and believable spacing. Keep copper warm but unevenly rubbed, not mirror orange. Cloth on rail is cream/marigold linen; use12 check as the final textile pattern.

### Dresser jars and crockery

About8–10 unlabelled glass jars, roughly100–150 mm diameter and160–250 mm tall. Show recognizably different grains, pulses, nuts and seeds: oats, lentils, chickpeas, beans, nuts, small seeds. Plain lids. Stacks of cream plates, several cream/marigold glazed jugs and a few green bowls. Enough gaps to distinguish jars; no dense wall of identical duplicates.

## Set dressing

- A few wooden spoons/spatulas in a plain cream jug, a simple whisk, two cutting boards.
- Rosemary, thyme and mint in three small terracotta pots by sea window; a small amount of dresser greenery can remain secondary.
- A few folded marigold napkins/tea towels; natural creases.
- ★ Small framed botanical watercolour **10-botanical-flat.png**, beetroot, kale and rosemary on cream paper. Use a simple oak frame around~240 ×300 mm; the supplied image includes its frame, so crop the paper inset if modelling a separate frame to avoid double-framing.
- No text, labels, logos, numbers, screens, modern appliances or plastic. Add all final lettering in Blender.
- The brief reserves barometer, wall clock, energy candles and clickable-object glow for Claude. They are deliberately absent from this pack. Keep blank plaster adjacent to sea window available.

## Materials

Hexes describe intended display colours; roughness values are Blender Principled starting points, not measured PBR properties.

| Material | Colour / roughness / wear |
| --- | --- |
| ★ Limewash | #f4efe4, roughness0.85–0.95; broad subtle mottling and shallow plaster texture; cream, not flat bright white |
| ★ Scrubbed pine | Approx.#ba945f to#c6a171, roughness0.65–0.85; pale end grain, knife marks, slightly darker seams, rubbed corners |
| Oak / beams / floor | Honey #986c42 to#b18451, roughness0.55–0.80; age-darkened grain and board gaps, local polished footfall only |
| Dresser paint | Warm cream #e9dfc9, roughness0.65–0.85; chips at knobs/edges, dirt in joints, wood visible sparingly |
| ★ Marigold linen | #d9a441 with cream #f4efe4; roughness0.85–0.95, real weave, tiny fibre variation, creases from mesh rather than a lighting gradient in tile |
| Runner fine green | Approx.#68754a; narrow woven accent, subordinate to marigold/cream |
| Cream enamel | Approx.#eee5d2, roughness0.25–0.40; worn chips expose dark iron at edges; no branding |
| Cast iron | #292923, metallic~0.6–1 depending finish, roughness0.65–0.85; dark seasoned surface and rubbed high spots |
| Copper pans | Approx.#b96e43, metallic1, roughness0.30–0.55; rubbed warm spots, darker restrained patina, no uniform mirror finish |
| ★ Brass horn / handles | Family #b07f52, metallic1, roughness0.30–0.50; localized dark patina, rubbed rim and crank fittings |
| Phonograph case | Deep walnut #603b24 to#805032, roughness0.40–0.60; softened joinery and worn varnish, not pristine lacquer |
| Earthenware / jugs | Cream and marigold glaze, roughness0.20–0.40; slight crazing, uneven glaze edge and occasional small chips |
| Clear glass | Transmission1, IOR~1.45–1.50, roughness0.03–0.08; restrained smudges. Build window rain/condensation/reflections in3D. |
| Trug timber | Worn honey chestnut/willow family #aa8253, roughness0.75–0.90; visible broad slat grain, rim/handle scuffs |
| Soil / roots | Deep brown #2c2416 to#514331, roughness0.90–1; crumbs and clinging patches rather than painted uniform dirt |

09-materials-moodboard.png is a tactile palette reference. It is not a set of calibrated PBR maps. Pattern tiles11/12 are intended for repeating fabric colour; use subtle mesh folds and your own normal/roughness treatment.

## Lighting

★ **Bright clear early morning.** Main warm sun enters through open TOP stable door from garden side, making long soft shadows across table/floor. Sea window adds broad cool-neutral daylight. Keep plaster and sky detail, with warm highlights on food and brass.

Suggested starting points:

| Light | Starting direction / colour / strength |
| --- | --- |
| ★ Morning sun | Low~15–25° elevation from east/garden, warm-neutral~4800–5400 K. Blender Sun strength~2–3, angular size~0.7–1.5°; adjust to01. |
| Sea-window fill | Soft~6200–7000 K sky/daylight; broad window-shaped fill if needed. Roughly one to two stops below direct table highlights. |
| World / bounce | Pale neutral-blue sky and warm wood bounce. Preserve shadow detail without flattening sun direction. |
| Practical | One small old brass wall light by range is visible in the concepts. Keep it secondary; warm~2700 K, about100–250 lumen equivalent if used. Daylight carries the room. |
| Phonograph accent | Natural garden-side beam across horn/crank and cream wall; avoid a separate theatrical spotlight. |

Values are art-direction starting ranges, not fixed physical measurements. Keep one consistent exposure/colour-management setup while testing views. The window/backdoor texture must not act like a luminous television; tune emission/world contribution against exterior daylight.

## Exterior plates and swaps

### Sea window:14–23

14-window-rain.png is the composition master. It uses Cuddlecore's rocky bay and layered headlands, seen from the nearby Flourish position farther toward the garden; the bay sits slightly farther left. Foreground is now kitchen-garden beds, brick paths, low stonewall and small side fruit trees.

- 14 Rain; 15 Fair; 16 Change/sea mist; 17 Stormy; 18 Very Dry.
- 19–23 use matching weather order at **11pm**, each generated from 14 independently.
- Rain: faint distant-town cloud glow and small warm cottage windows.
- Fair: stars, faint horizon glow and moonlit water, **moon out of frame**.
- Change: sea fog and blurred cottage-light haloes.
- Stormy: heavy cloud, driving rain, surf and one lighthouse beam.
- Very Dry: warm still night, flat dark sea, tiny remaining horizon glow and warm windows.

### Garden door:24–29

24-garden-rain.png is a separate composition master. Brick path between raised beds, low wall, sea to the left; Inn wall, bench, wooden barrel water butt and sage lean-to glasshouse to the right.25–28 match the five weather readings,29 is one dark11pm version with warm existing Inn windows lighting the path.

**Garden seasons are not included.** Keep bed positions, crop types and growth stages fixed. Very Dry changes surface moisture/grass and haze; Stormy permits moving foliage and waves. Neither turns the garden into a different season.

All exterior plates are ultrawide perspective backdrops, not equirectangular360 images. Put them a few metres beyond openings and scale/test coverage from oblique viewpoints. Model close brick/bed/wall edges if camera translation reveals parallax that one plane cannot supply. Window glass and the stable-door leaves remain real Blender geometry.

Use the same UVs and one registered image plane for each set. Blend weather/day-night plate colours; change the room's actual illumination in step with the state. Use shared scene geometry and locked cameras for exact final panorama geometry. Alignment-report.json records the delivered image checks and their limits.

## Delivery and numbering

28 requested PNGs:01–12 and14–29. No file13. The source prompts and revisions are in prompts.json; selected asset dimensions/hashes in asset-manifest.json. The gallery provides weather/day-night comparison controls and fabric-repeat previews. layout.json carries modelling coordinates and canonical object references.

Images were made with the built-in image-generation tool. Size/registration checks and fabric repeat alignment are documented separately; generator originals remain unchanged.

