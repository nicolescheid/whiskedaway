# WhiskedAway — hallway & entrance hall: Blender shopping list
18 October 2026 · Part A, photoreal concept pack

★ marks an essential mood or navigation element. Dimensions, material values and light levels below are proposed build starting points, not measurements recovered from the images.

## Look and layout authority
★ Same coastal English/Kiwi inn as Cuddlecore: cream limewash (#f4efe4), dark honey wide boards, low oak beams, rubbed oak doors, aged brass (#b07f52), deep brown (#2c2416), faded berry (#8b4d5c), cream and blue runner. Rainy late afternoon, cool daylight and small warm pools from brass lamps. Used, comfortable and timeless.

The existing project document **docs/inn-floorplan.html** was read from C:/dev/www/WhiskedAway/whiskedaway-react/. Its ground-floor room arrangement controls the build. The supplied prose fixes the hallway at about 1.8 × 8 m.

Facing the sea from the entrance:
| Position | Physical room | Dial location |
|---|---|---|
| Front left / hill side | Sweet Spells | Beside frame on its entrance/front-door side |
| Back left / hill side | Cuddlecore | Beside frame on its entrance/front-door side |
| Front right / garden side | Chiapothecary | Beside frame on its entrance/front-door side |
| Back right / garden side | Flourish | Beside frame on its entrance/front-door side |

★ There are FOUR room doors off this corridor, TWO per side, with FOUR matching dials. No extra room doors between Cuddlecore and the sea window. Stairs and notice board belong in the entrance hall. The grandfather clock belongs in the corridor.

The slightly ajar everyday door in the wide views is the FRONT RIGHT Chiapothecary door. Its ordinary warmth/herbs glimpse is separate from the deliberately magical Cuddlecore-to-glasshouse transition in image 07. In that transition a dial choice changes the destination; it does not change the physical room map.


The user's Markdown copy of the agreed floorplan was also reviewed and matches the project's room descriptions, sea/lane orientation, glasshouse placement and build order. It is retained as source-floorplan.md; no additional implementation instructions from that reference were treated as new work requests.

## Structure — walls, beams, floor, sea window, front door and fanlight, stairs
- ★ Corridor shell: approximately 1.8 m clear width × 8 m long, straight from entrance hall to sea window. Proposed ceiling 2.7 m, exposed beam undersides around 2.45–2.5 m. Reuse Cuddlecore's wall/floor material scale.
- ★ Entrance hall: wide and shallow across the front of the house. A 10.8 × 2.2 m envelope is a useful starting estimate from the schematic; confirm against the actual building model before construction.
- Cream limewashed plaster with restrained trowel texture and softly worn corners; cream painted timber skirting and simple trims.
- ★ Low oak crossbeams, roughly 180–220 mm sections, grain along timber; small cracks and old contact wear, no exaggerated destruction.
- ★ Dark honey floorboards, about 180–240 mm wide, modest gaps and occasional old nail heads. Wear follows walking routes and thresholds.
- ★ Tall timber sash at the sea end, approximately 1.0 m wide × 1.8 m tall, six-pane sashes as the chosen concept frame shows. Cool gray rainy sea beyond. Match one window model across all cameras; do not transplant the kitchen's whole wall into the hall.
- Berry curtain edges on a simple rod, creased faded linen. Plain oak sill. Existing coastal backdrop assets can inform the sea view; frame/scale them appropriately for this window.
- ★ Old painted timber FRONT door in the village-lane wall, approximately 0.95 × 2.1 m; deep brown painted surface, cream frame and aged brass round knob. Semicircular glazed fanlight above, with simple radial muntins. Follow the project's floorplan for its exact lateral offset; do not infer a new position from photographic perspective.
- ★ Staircase along the LEFT side of the entrance hall when facing sea, RIGHT when looking back from sea. Turned oak balusters, rounded newel, rubbed handrail and worn woven runner. Proposed 0.95–1.0 m flight width; about 2.7 m floor rise over approximately 3.7–3.9 m run. Resolve risers/treads within the actual build's proportions.
- ★ Small low stiff cellar door under stairs, approximately 0.65 × 1.25 m, old oak/cream trim and round brass knob. It stays under the entrance-hall stairs; it is not a fifth corridor room door.
- Entrance-hall notice board is on wall to RIGHT of hallway opening when facing sea; its back is not necessarily visible in the reverse corridor view.

## Doors and dials — four room doors, cellar door, plate and pointer
- ★ Four room-door instances from the same old oak FOUR-panel family: two upper and two lower recessed fields, cream painted frame, aged round brass knob. Proposed leaf 0.85 × 2.05 m × 40–45 mm; frame/jamb about 80–100 mm face width. Use matching rails/stiles, wood scale and edge profiles.
- ★ Cuddlecore door is the other side of the existing kitchen door in cuddlecore/04-back-wall.png. Use one physical door assembly shared by the rooms. From a front-on hallway view of this left-wall door, its dial is on IMAGE LEFT (toward entrance); the corrected close-up has left hinges and knob on right. Confirm swing/clearance with the built kitchen before finalizing.
- Other doors can use handed variants of the same construction to suit room clearance; do not mix unrelated modern door styles.
- Cellar door: distinct low under-stair prop, stiffer and simpler. The four corridor room dials are the required instances in this pack; no extra dial was added to the cellar/front door.
- ★ Dial plate: 200 mm outside diameter; proposed 3 mm thickness, shallow rolled/beveled rim, 12 mm center spindle, aged brass with brighter hand-contact wear.
- ★ EXACTLY NINE stations at 40° increments: one small engraved star at 12 o'clock, EIGHT smooth blank inset/engraved name plates. There is NO plaque at exact 6 o'clock; the bottom pair flank it. Proposed station radius 75 mm and oval plaques around 28 × 19 mm. Use analytic geometry for the final Blender mesh.
- ★ Pointer is a separate brass object, proposed 75 mm from spindle to upper tip, simple narrow tapered shaft/rounded grip and modest countertail. Model the spindle and turning knob separately where useful, then rotate the pointer about that spindle.
- Plate and pointer are separate flat references: 05 has no pointer; 06 points up with its hub registered to exact image center (626.5, 626.5 in the 1254 px square). Neutral gray background is intentional; these PNGs do not include alpha cutouts.
- 05-dial-plate-flat.png is the final dial design authority. Reuse one shared plate/engraving design and pointer family across every door; the wide scenes simplify small details.
- Only the star notch has a VERY faint warm accent in the assembled scene. No steampunk gears, light rings, sparks or swirls.
- Keep all plaques blank in the concept artwork. Claude adds these exact names in Blender: **Cuddlecore, Flourish, Sweet Spells, Chiapothecary, Glasshouse, Nourish Academy, Cravings Decoded, The Hall**.
- dial-layout.json supplies exact nine-station angles and a proposed clockwise name order. Respect any existing application mapping; keep all instances consistent.

## Furniture — clock, notice board, boot bench, umbrella stand, coat pegs
- ★ One slender grandfather clock in dark oak, proposed about 0.42 m wide × 0.25 m deep × 2.1 m tall. Place against LEFT corridor wall between its two room doors, out of all door swings. Remaining clear width about 1.55 m at the case.
- Clock has rubbed molded hood, long trunk, base/plinth, pendulum chamber and aged brass fittings. Image 08 is the face design authority: cream painted dial, brass spandrels, blackened hands and moon-phase arch. Bring that arch into the final shared clock model; small wide-view face details are secondary.
- ★ Face uses twelve simple hour dots/bars only in the concept. No Roman/Arabic numerals, maker name or dates. Claude adds final numerals to match the kitchen clock and drives both clocks from the same time state.
- ★ Oak-framed cork notice board, about 0.60 × 0.80 m, on entrance-hall wall right of hallway opening. Frame about 45–55 mm wide, subtly rubbed and nicked; warm natural cork.
- Plain worn boot bench, roughly 1.1 × 0.35 × 0.45 m, in entrance hall near front door; modest berry cushion if used, room under bench for footwear.
- Tall practical umbrella stand, about 0.25–0.3 m diameter × 0.55 m high; earthy glazed stoneware in the chosen image. Two or three closed old umbrellas, no branding.
- Wood peg rail with 3–5 simple wooden pegs near front door. A couple of plain worn coats, linen/wool, no readable tags. This lies mostly outside the chosen first camera crop; include it in the 3D entrance hall.

## Set dressing — small objects
- ★ One continuous faded berry/cream/blue runner down the middle of corridor, proposed 0.75–0.85 m wide × around 6.7–7.1 m long. Soft frayed edges and worn tread area; do not turn it into separate unrelated rugs between cameras.
- Worn stair runner in the same textile family, fixed plainly to stair treads; modest entrance mat near front door.
- Six blank paper pieces on notice-board detail: card, folded note, plain kraft seed packet, larger notice, small slip, pressed herb leaf on cream backing. Small aged brass pins, slight angles, faint natural aging only. No lettering/scribble textures.
- A small cream jug and restrained stems at sea-window sill, a small plain bowl and a couple of unlabelled books if retained from concept.
- Small wicker basket at sea end, kept clear of the walking/turning area.
- Modest potted plant in entrance hall if needed; do not let props hide dials or create a corridor obstacle.
- ★ Warm narrow light gaps at some door thresholds and a restrained greenery glimpse from the front-right ajar door.
- Glasshouse-transition glimpse: herb leaves, terracotta pots, old timber staging, fine glasshouse frames, one watering can if desired. Morning sun and natural shadows supply the magic. This is a portal mood reference, not a replacement floorplan.

## Materials — color, roughness, wear
Values use the 0–1 roughness convention. They are suggested starting ranges, not calibrated material measurements. Choose base colors under neutral lighting; don't bake the warm photo illumination into all surfaces.

| Material | Color / variation | Roughness | Wear / treatment |
|---|---|---|---|
| ★ Limewashed plaster | #f4efe4, restrained gray/cream mottling | 0.85–0.95 | Soft trowel marks and contact wear; no glossy stucco. |
| ★ Wide floorboards | honey #8b5d35 through dark brown #2c2416 | 0.5–0.8 | Rubbed footpaths, occasional nail heads, dull gaps, modest scratches. |
| Oak beams | #76502d to #4c3422 | 0.65–0.85 | Small splits, old tool texture, softened exposed edges. |
| ★ Door oak | warm #9b693e with deep grain | 0.45–0.65 | Hand-polished edges/knob area, localized dents, natural uneven grain. |
| Cream painted trim | #eee5d3 | 0.45–0.65 | Thin chips at corners and contact points, wood beneath. |
| Front-door paint | #2c2416 with rubbed brown edges | 0.5–0.7 | Modest old paint wear; no showroom lacquer. |
| ★ Runner / stair weave | #8b4d5c, #e2d6bf, faded blue #73828b | 0.85–1 | Soft flattened pile/weave, faded pattern, small edge frays. |
| ★ Dial brass, unworn/tarnished | #b07f52 nominal art-direction hue; variable brown-gold | 0.4–0.65 | Patchy aged patina in recesses, fine scratches; metallic response. |
| ★ Dial brass, hand-rubbed | lighter warm gold #bd9655 | 0.2–0.4 | Brighter pointer grip and touched rim; broad highlights, never mirror gold. |
| Dark oak clock case | #3b291d to #2c2416 | 0.35–0.6 | Thin old finish, rubbed moldings, small corner chips. |
| Painted clock dial | #e5d9bf | 0.65–0.85 | Fine restrained crazing and foxing, clear simple hour marks. |
| Blackened clock hands | #242321 | 0.45–0.65 | Tiny worn edges, no chrome sheen. |
| Cork | #a47743 with dark flecks | 0.85–0.95 | Real granules, a few pin holes; no exaggerated displacement. |
| Paper / kraft | #eadfc7 / #b69268 | 0.85–0.95 | Creases, soft worn edges, blank surfaces. |
| Window / fanlight glass | near-neutral, very slight tint | 0.03–0.12 | Real thickness, mild old-glass variation, external rain separately. |
| Umbrella-stand stoneware | #8d7350 / warm speckled tan | 0.3–0.55 | Worn glaze and a little rim variation. |
| Terracotta / herb leaves | #a45d3a / muted natural green | 0.7–0.9 / 0.4–0.65 | Natural pot mineral marks and believable leaf translucency. |

10-materials-moodboard.png is the nine-sample reference: plaster, boards, beam, door oak, runner, brighter worn brass, darker unworn brass, clock-case finish and cork. It is not a set of seamless PBR maps.

## Lighting — source, temperature, rough brightness
Estimates below are art-direction starting points. Balance them with the existing kitchen exposure and real scene scale.

| Source | Color temperature | Approximate brightness / role | Placement |
|---|---|---|---|
| ★ Rainy sea-window daylight | 6500–7500 K | Broad cool end fill; roughly 80–180 lux near window, falling along corridor. | Through the single tall rear sash; gray sky with detail. |
| ★ Front fanlight daylight | 6500–7500 K | Soft cool entrance fill, roughly 60–150 lux nearby. | Through front-door fanlight; no invented extra front windows. |
| ★ Two brass wall lamps | 2500–2700 K | About 100–180 lumens each, modest shielded warm pools. | One left/front corridor area, one right/rear; keep the same physical positions in reverse view. |
| ★ Under-door / ajar-room spill | 2500–3000 K | Very low, a narrow inviting line; roughly 5–15 lux immediately at threshold. | Some room doors, with front-right ajar herbs glimpse. |
| ★ Star-notch accent | warm amber, about 2300 K | Barely visible close-up accent; does not illuminate hallway. | One star notch on each shared dial design. |
| ★ Magic glasshouse daylight | roughly 4500–5500 K | Bright relative morning sun; proposed 300–700 lux locally inside/at threshold. | Beyond temporarily opened portal, spilling a readable warm shape onto hall floor. |
| Indirect bounce | Derived from above | Gentle warm shadows and retained corner detail. | Plaster and wood, with no unexplained extra lamp fixtures. |

Camera: full-frame 24 mm, about 1.6 m eye height, level verticals, around f/4 for wide views. Use one exposure/white balance and one modeled architecture for final panoramas; concept-camera composition is not a 360° registration.

## Proposed coordinate blockout
Meters; x is hill-to-garden (left to right facing sea), y increases toward sea, floor z=0. Hall opening at y=0, sea wall y=8, corridor walls x=±0.9.
- Sweet Spells: x=-0.9, y=2.0.
- Cuddlecore: x=-0.9, y=6.0.
- Chiapothecary: x=+0.9, y=2.0.
- Flourish: x=+0.9, y=6.0.
- Dial centers: same wall, y=door center minus about 0.70 m, z=1.30 m. This is the front-door side in BOTH camera directions.
- Clock: against hill/left wall, around y=4.0, between left doors. Seen on right when camera reverses.
- Entrance hall: roughly x=-5.4…+5.4, y=-2.2…0; stairs on hill/left side, notice board to garden/right of hallway opening.
- Front door: in lane wall y=-2.2; preserve its garden-side offset shown in the supplied floorplan when resolving exact build coordinates.

layout-plan.svg and layout.json make the four-room and dial placement explicit. Proposed measurements can change to fit the existing build; room assignment, left/right relationships and front-side dial rule must remain fixed.

## Asset authority and delivery
- 01: entrance-hall look, stairs left and board right.
- 02: corridor toward sea, four room doors/four dials.
- 03: reverse corridor, front door/fanlight, clock and stairs to viewer's right, dials moved to front-door side.
- 04: corrected Cuddlecore door-side detail, with no extra door/clock between it and sea window.
- 05: authoritative blank nine-position dial plate.
- 06: separate up-pointing pointer with centered hub.
- 07: magical glasshouse doorway mood.
- 08: authoritative clock face/moon-phase detail.
- 09: six blank notice-board paper pieces.
- 10: materials still-life.

Images were generated and visually reviewed with targeted corrections to dial count, dial side, room placement and modern fittings. Front/reverse images are concept views, not geometrically identical panoramic faces. Fine hinges, lamp sightlines, clock-face proportions and texture details should be unified in the single Blender build. Room layout comes from the project plan and coordinate blockout; don't invent extra doors from perspective overlaps.

All images use the built-in image tool. The separate pointer was subsequently normalized/registered using the deterministic alignment workflow previously authorized; its source and pivot are recorded in pointer-registration.json. Exact prompts/revisions are in prompts.json. The source brief is retained in source-brief.txt.

Part B's storybook inn-in-a-whisk artwork lives in its separately created chat; this folder contains only Part A's photoreal work. No 3D rooms or website implementation were changed.

