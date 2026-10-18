# WhiskedAway — Glasshouse build notes

Concept pack for the lean-to beside the Inn. ★ marks the details that carry the mood. Dimensions below are proposed modelling dimensions unless the brief gives them explicitly. The images are photographic art direction; this written layout resolves incidental differences between generated camera angles.

## Decisions and continuity

- ★ Cream limewash, old oak, honeyed staging, worn terracotta and quiet aged brass match the Cuddlecore/hallway family. Sage-green timber glazing bars follow this brief and the illustrated exterior; they supersede the white bars in the hallway glimpse.
- Use terracotta square tiles rather than brick.
- The current brief's four-panel oak Chiapothecary door supersedes the floorplan card's older “glass door” wording. Keep its connection in the lane half of the Inn wall.
- One lean-to roof plane, highest at the Inn wall. No ridge, second pitch or second solid long wall.
- The garden exit is in the middle of the LONG glazed side. The lane and sea end walls are glazed; neither gains an extra exit.
- Seasonal master: 01-to-garden-door.png. 09-spring.png is an exact copy. Summer, autumn and winter each start from 01, never from the previous season.
- Outdoor master: 13-outside-spring.png. Each outdoor season starts from 13.
- Spring depicts a protected late-spring display, with a small amount of early flowering. These are four evocative stages of a mild coastal glasshouse, not universal planting calendars for every visitor's climate.

## Structure

★ Interior footprint: **1.8 m across × 6.3 m long**. Local coordinates: x=0 at the Inn wall, x=1.8 at garden glazing; y=0 lane end, y=6.3 sea end; z=0 finished floor.

| Element | Proposed build |
| --- | --- |
| Inn wall | Cream limewashed plaster, full 6.3 m length. Slight waviness and worn lower edge. |
| Garden wall | Glazed long wall at x=1.8. Divide into slender sage timber bays, with central door opening. Use 01 as the camera/composition authority. |
| End walls | Glass at y=0 and y=6.3, framed in sage timber. Fixed lower panes; any roof vent stays subtle and traditional. |
| Roof | Single glass plane from z≈2.75 m at Inn to z≈2.15 m at garden. Approximately 18° fall across 1.8 m. Timber bars ≈35–50 mm face width; main posts ≈70–90 mm. Heights are modelling proposals, not measured from the images. |
| Floor | Worn terracotta tiles about 230–250 mm square, 6–10 mm irregular dusty grout. Slight variation, rounded edges, occasional small chips. |
| Garden door | Sage timber, glazed upper portion, modest opaque lower panels, old brass knob/latch. At x=1.8, centre y=3.15; nominal leaf ≈0.82 × 1.95 m. Leave the approach clear. |
| Glass | Thin, mildly wavy clear glass, with restrained edge grime and light condensation high up. Keep the main view legible. Glazing, condensation and reflections are Blender geometry/material effects; outdoor PNGs contain none. |

Camera guide: 01 looks across +x from the Inn side, garden door central, wheel to image right (lane side). 02 looks +y toward sea: Inn wall left, garden right. 03 looks −y toward lane: Inn wall right, garden left. 04 faces the Inn wall with lane to image left and sea to image right. 05 looks up at the single roof slope. These are separate concept photographs, not sections of a stitched panorama.

## Doors and wheels

- *Superseded 18 Oct 2026: the Chiapothecary door is now glazed (small panes of old glass, herb-green frame, brass furniture), to match brief #8. The oak description below is kept as ChatGPT wrote it.*
- ★ **Chiapothecary door:** old oak, four recessed panels, ≈0.85 × 2.0 m, at x=0 and y≈1.9 m. Reuse the hallway door mesh/material family, with old brass handle. Keep a shallow clear landing on both sides.
- ★ **Room dial:** ≈200 mm diameter, aged brass, centre z≈1.35 m, beside the oak door on its lane side. Reuse the established hallway dial: **nine equally spaced stations at 40°**, star at the top and eight blank room plaques. Add crisp room text in Blender. It is separate from the four-season wheel.
- ★ **Seasons wheel:** ≈300 mm diameter, brass rim, dark old timber centre, mounted on a reinforced post beside the garden door on its lane side (image right in 01). Centre z≈1.3–1.4 m. Four blank cardinal plates, four engraved leaves between them, central spindle and small turning handle.
- Use **17-seasons-wheel-flat.png** as the season-wheel face authority. Its handle is deliberately absent: build the handle separately so it can turn. Add season names in Blender, using the same UVs and registration in all four states.
- Keep the wheel face/handle angle fixed in the seasonal concept images. Animate the real control independently of the seasonal backdrop cross-fade.
- Tiny dial details in oblique views are suggestive. The counts and dimensions above, plus the flat texture and existing hallway dial, govern the model.

## Furniture

| Element | Size / location / treatment |
| --- | --- |
| ★ Garden staging | Two timber runs against garden glass, split around the central door. ≈450 mm deep, 780–820 mm high. Weathered planks, square legs and lower shelves; leave an unobstructed central approach. |
| Sea-end staging | Short return where it fits without blocking glazing or walk space. A few medium pots, not a wall of foliage. |
| Beds / troughs | Low timber growing boxes ≈450–700 × 250–350 × 180–250 mm under staging or against otherwise clear wall. Deep terracotta floor pots for ginger/turmeric instead of a large bed across the path. |
| Drying beam | Honeyed old timber along Inn wall, ≈70 × 90 mm section at z≈2.05–2.2 m, avoiding door head. Small uneven bunches of rosemary, thyme, sage and lavender tied with twine. |
| Floor clearances | Aim for ≈0.85–1.0 m usable path through the narrow room, with no pot encroaching on either doorway. Check mesh bounds in Blender; do not infer clearance solely from a wide-angle photograph. |

## Plants

All heights are approximate **above soil** for the displayed models, not maximum garden sizes. Keep roots/pots and the main trained vine route fixed between seasons. Seasonal variants may alter growth and flower meshes, but never move the containers. Identity should come from leaf shape and growth habit as well as flower colour.

| Plant / model identity | Placement and display size | Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- | --- | --- |
| ★ Chamomile — Roman, *Chamaemelum nobile* | Small/medium clay pots on staging, 0.15–0.30 m. Fine divided foliage; small white daisies with yellow centres. | Fresh fine foliage, a few late-spring flowers | White daisies, rounded yellow centres | Short dry heads, lower green mat | Low sparse green mat, no mass flowering |
| Lavender — *Lavandula angustifolia* | Sunward staging, 0.35–0.60 m. Narrow silvery leaves and slender spikes. | New silver shoots, first purple spikes | Purple spikes, fuller mound | Dry grey spikes, silver foliage | Woody silver-green mound |
| Lemon balm — *Melissa officinalis* | Own medium pot, lane-half staging, 0.25–0.50 m. Soft wrinkled serrated leaves. | Bright new rounded leaves | Loose leafy bush | Thinning yellow-green stems | Basal growth / short old stems |
| Peppermint — *Mentha × piperita* | Separate pot or contained trough, 0.25–0.55 m. Opposite pointed serrated leaves. | Upright new shoots | Lush green growth, occasional small flower spike | Thinning darker/yellowing leaves | Tiny basal shoots; most top growth gone |
| Fennel — *Foeniculum vulgare* | Deep floor pot toward sea end, 0.70–1.20 m. Tall feathery sprays. | Fine fresh fronds | Tall feathery growth, restrained yellow umbels | Tan seed umbels and stems | Short stems / sparse basal fronds |
| Ginger — *Zingiber officinale* | Deep clay pot under/near staging, 0.35–0.90 m. Upright canes with narrow lance-shaped leaves. | Emerging shoots | Taller green leafy stems | Yellowing and reducing foliage | Dormant rhizome pot, short dry stems |
| Turmeric — *Curcuma longa* | Distinct deep floor pot, 0.40–0.90 m. Broad upright pleated leaves, distinct from ginger. | New broad leaves | Full broad green blades | Yellowing broad leaves | Dormant rhizome pot, no lush canopy |
| Echinacea — *Echinacea purpurea* | Medium clay pot toward sea-side staging, 0.40–0.80 m. Coarse pointed leaves; raised central cone. | Basal foliage, few/no flowers | Pink drooping rays around orange-brown cones | Prominent dark seedheads | Bare stems and seedheads |
| Thyme — *Thymus vulgaris* | Small low pots / tray edge, 0.10–0.25 m. Tiny opposite leaves on woody stems. | New low shoots | Dense fine foliage, tiny flowers optional | Muted green woody mat | Sparse evergreen mat |
| ★ Sage — *Salvia officinalis* | Medium staging pot, 0.25–0.50 m. Soft grey oval leaves with textured surface. | New pale leaves | Fuller grey-green bush | Slight thinning | Restrained grey-green evergreen foliage |
| Holy basil — *Ocimum tenuiflorum* (syn. *O. sanctum*) | Sheltered staging pot, 0.25–0.60 m. Opposite serrated oval leaves, some purple tint. | Young leafy plant | Bushier growth, small pink-purple flower spikes | Older thin stems / seed spikes | Sparse spent plant or tiny replacement seedlings in the same pot |
| Calendula — *Calendula officinalis* | Small/medium staging pots, 0.20–0.45 m. Orange/yellow daisy heads, broader simple leaves. | Early orange flowers | More blooms, varied stages | A few last blooms, curled seedheads | Spent stems / a few seedlings |
| Aloe vera — *Aloe vera* | One deep pot near garden light, 0.30–0.55 m. Fleshy toothed rosette, no spiny cactus substitution. | Intact rosette | Fuller rosette | Similar green rosette | Intact protected rosette |
| ★ Rosemary — *Salvia rosmarinus* | Larger clay pot near sea-end garden glazing, 0.45–0.90 m. Woody upright stems, narrow needle-like leaves. | Fresh tips; tiny pale flowers optional | Deep green upright growth | Woody muted green | Evergreen structure |
| Borage — *Borago officinalis* | Medium pot on sunny staging, 0.35–0.70 m. Coarse hairy leaves, blue five-point star flowers. | Young rough leaves | Blue stars on loose stems | Spent seed stems | Spent stems / seedlings |
| Hibiscus / roselle — *Hibiscus sabdariffa* | Larger pot toward lane end, 0.60–1.10 m. Lobed leaves, reddish stems, fleshy red calyces in late season. | Young leafy plant | Taller leafy stems, restrained flowers | Small red calyces, not large ornamental red hibiscus blooms | Sparse spent stems / replacement seedling stage |
| ★ Passionflower — *Passiflora incarnata* | Root pot by garden corner; tendrils trained 3–5 m beneath roof. Three-lobed leaves; white/purple fringed flowers. | Fresh trained shoots, a few late-spring flowers in the protected display | Fuller canopy with scattered flowers | Yellowing olive leaves, gaps and old heads | Main trained stem route remains, mostly bare; no flowers |

Use the identities above for final labelled plant meshes. Generated wide views are not reliable botanical specimens for every small, overlapping leaf. Use the close-ups for clay, foliage texture and density, and the cited references below for distinct plant forms. Do not make every species flower together.

Ginger, turmeric, aloe, holy basil and roselle imply a protected tender-plant display. Winter imagery simplifies that display to quiet rosettes, stored rhizome pots, spent stems and small replacements. It does not prescribe how all these plants would overwinter in an unheated glasshouse in every climate.

## Set dressing

- ★ Approximately 25–40 clay pots across the whole room, varied 100–400 mm diameters; no plastic. Some chipped rims, saucers, mineral tide marks; avoid identical duplicates.
- Two or three wooden seedling trays, ≈400 × 250 mm, with uneven rows and a few gaps.
- One small hand trowel, worn timber handle and dull steel blade; coil of jute twine; a few freshly cut rosemary, thyme or mint stems.
- Small dull metal watering can, about 1.5–3 litres, tucked beneath staging; no hose or irrigation fittings.
- Eight blank label shapes from **19-plant-labels-flat.png**. Add crisp names later; keep the photo textures blank.
- Six botanical seed packets from **18-seed-packets-flat.png**: chamomile, calendula, lavender, echinacea, borage, mint, with no lettering in the supplied sheet.
- ★ Small wind chime by garden door: 3–5 aged brass tubes ≈100–220 mm long, timber cap/clapper and thin cord. Fixed in the season images; sound/motion can be separate.
- ★ Soil crumbs, a handful of yellow leaves, dusty tile corners and restrained pot chips. Fixed dressing stays registered between seasons.
- No people, animals, text, logos, modern fittings or decorative unrelated plants.

## Materials

Values are Blender Principled BSDF starting points, not measurements. Colour hexes describe intended display colour; use sensible colour management and test under the chosen exposure.

| Material | Colour / roughness / wear |
| --- | --- |
| ★ Limewash | #f4efe4, roughness 0.85–0.95, soft broad mottling and fine plaster bump; cream rather than bright white |
| ★ Sage paint | Approx. #8d9b80, roughness 0.60–0.75; chipped edges expose warm wood; shallow cracks, no uniform grunge overlay |
| Old oak door | Approx. #8b623d, roughness 0.55–0.75; long grain, softened rails, slightly darker hand wear |
| Staging timber | Approx. #a67c4e, roughness 0.70–0.90; grey/honey variation, soil-darkened seams, rubbed edges |
| ★ Floor terracotta | Approx. #b56f4a with #c5865c variants, roughness 0.75–0.90; occasional polished footfall, rounded chips, dusty grout |
| Pots | Approx. #b9714c, roughness 0.80–0.95; varied firing, chalky off-white mineral deposits, dark damp soil line |
| Glass | Transmission 1, IOR ≈1.45–1.50, roughness 0.03–0.10; shallow broad waviness. Condensation as sparse separate mask high on panes, not blur over the whole view |
| ★ Aged brass | Base family #b07f52, metallic 1, roughness 0.35–0.55; localized darker brown patina, rub on handle edges; no mirror-gold finish |
| Potting soil | #352b21 to #514331, roughness 0.90–1; granular mesh/texture mix and occasional pale grit |
| Twine / linen | #b8a383 / #d5c8ad, roughness 0.90–1; visible fibres, restrained fuzz |
| Slate / wood labels | Dark grey #484b47 or worn pale brown #a78d6a, roughness 0.75–0.95; completely blank |
| Leaves | Species-specific greens, modest translucency and roughness variation; avoid waxy identical foliage |

## Lighting

★ Soft morning, gentle glazing-bar shadows, believable detail in cream surfaces and the sky. Keep exposure and colour management consistent across renders. These starting values are art direction; tune against 01, not as fixed physical measurements.

| Season | Sun / sky starting point | Relative overall brightness |
| --- | --- | --- |
| Spring | Low sun ≈25–30° elevation, warm-neutral 5000–5400 K, pale cool sky fill. Blender Sun strength ≈1.5–2.0 as a starting range | 1.00 |
| Summer | Morning sun ≈35–40°, 5400–5800 K, fuller blue sky fill; soft edge shadows. Sun ≈2.0–2.5 | 1.15 |
| Autumn | Lower sun ≈15–22°, 4400–4900 K, cooler blue-grey sky fill. Sun ≈1.0–1.5 | 0.85 |
| Winter | Low weak sun / broad cloud fill, ≈10–18° if visible, 6200–7000 K sky impression. Sun ≈0.3–0.7 or cloud-soft world lighting | 0.55–0.65 |

Keep the broad direction from garden to Inn consistent. A Sun angular size around 1–3° plus world fill is a useful soft-shadow starting point. Do not warm every pixel uniformly: terracotta can stay warm against a cool winter sky.

## Outside and seasonal swaps

★ Low old stone wall, herb-and-flower garden, an elder shrub and the familiar sheltered sea/headlands. The elder is explicitly allowed outside in addition to the 17 indoor species. Its compound foliage and flat cream flower clusters should read as elder, not hydrangea.

- Outdoor panoramas are perspective backdrop plates, **not equirectangular 360° panoramas**. Keep glasshouse frames/glass/reflections absent.
- Put the outdoor plate a few metres beyond the glazing as requested, scale to cover all relevant viewing angles and test from both ends as well as the central doorway. A single plane cannot give true foreground parallax: model nearby stones/plants if the camera moves enough to reveal it.
- Use the same mesh, UVs, dimensions and material settings for all four plates. Blend image colours with one season parameter. Share the camera between indoor seasonal renders and keep structure and pot transforms locked.
- Do not use the outdoor plate to decide the room's architectural dimensions.
- Rotate the seasons control and transition foliage/light separately; maintain one authoritative state for the selected season.
- Add all lettering in Blender. Neither dial face nor plant-label texture is a source of baked AI lettering.

## Botanical references

These primary horticultural/botanical sources informed identities and seasonal art direction; they are not recipe or medical-efficacy references.

- [RHS: chamomile](https://www.rhs.org.uk/herbs/chamomile/grow-your-own) — fine foliage, white/yellow daisies, annual versus perennial forms.
- [RHS: calendula](https://www.rhs.org.uk/plants/62350/calendula-officinalis/details) — annual/biennial form and orange flower heads.
- [RHS: culinary ginger](https://www.rhs.org.uk/plants/19233/zingiber-officinale/details) — leaf form and seasonal stem dieback.
- [NC State Extension: turmeric](https://plants.ces.ncsu.edu/plants/curcuma-longa/) — broad leaves and rhizome dormancy.
- [RHS: holy basil](https://www.rhs.org.uk/plants/50957/ocimum-sanctum/details) — identity, foliage and flowers.
- [RHS: mint](https://www.rhs.org.uk/herbs/mint/grow-your-own) — peppermint identity and winter dieback.
- [RHS: rosemary](https://www.rhs.org.uk/herbs/rosemary/grow-your-own) — evergreen woody form.
- [NC State Extension: Passiflora incarnata](https://plants.ces.ncsu.edu/plants/passiflora-incarnata/) — tendrils, three-lobed foliage and climate-dependent dieback.
- [RHS: passionflower growing guide](https://www.rhs.org.uk/plants/passion-flower/growing-guide) — differing species and protected cultivation.
- [Kew: roselle identity](https://mpns.science.kew.org/mpns-portal/drugDetail?drugName=roselle), [UF/IFAS: roselle](https://ask.ifas.ufl.edu/publication/HS1517) — Hibiscus sabdariffa and its calyces.

