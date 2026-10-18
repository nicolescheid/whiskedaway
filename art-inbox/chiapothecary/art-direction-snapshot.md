# WhiskedAway — graphic design and art direction

Updated 18 October 2026. Handoff for future art briefs, image generation and the Blender build. This consolidates the supplied briefs, approved choices and delivered pack notes; it does not commission new assets or confirm implementation beyond what Nicole has reported.

## Start a new brief here

Read this note, the new brief and the relevant room’s notes before generating. Attach the actual approved reference images: a filename alone does not supply visual context.

Carry forward these essentials:

- One lived-in English/Kiwi coastal Inn, with a coherent floorplan, coastline, materials and door family.
- Photographic rooms; storybook Inn illustration; stylised 3D Gemma. Preserve each established treatment.
- Gemma is **Direction C**, with **soft blue cheeks and no rosy blush**. Her two approved v2 images are the identity masters.
- Weather, night and season variants start from their own composition master and retain fixed architecture and landforms.
- All generated artwork is free of lettering unless a new brief explicitly changes that. Crisp functional text is added in the build.
- Use the latest canonical assets and notes. Earlier comparison sheets and ZIPs can contain superseded designs.

A useful opening for a fresh conversation:

> Continue WhiskedAway using the attached art-direction notes and approved references. Follow the new brief’s scope and filenames. Preserve the established building, materials and visual treatment. If Gemma appears, use the approved Direction C v2 identity, with soft blue cheeks and no blush. Keep any variant series registered to its designated master.

## What the project should feel like

A cooking website that is also a small virtual world: an old countryside Inn on a headland above the sea, held inside a giant whisk in its storybook artwork. Visitors explore rooms, notice objects and receive gentle help from Gemma.

Warm, practical, tactile and quietly magical. Real wear, food, rain, steam and small pools of light make it welcoming. Each room has its own emotional character while belonging to the same house.

ChatGPT supplies concept frames, flat artwork, backdrops and character references. Claude builds coherent Blender rooms and browser interactions. Individual generated wall views are art direction, not geometrically registered panorama faces.

## Which references govern

Nicole’s latest explicit direction takes precedence over older suggestions. The agreed floorplan governs physical room placement; the latest room brief and its written layout settle details within that plan. Approved composition masters govern variants. Dedicated flat references govern small mechanical details that wide room images simplify.

Dimensions, roughness and light values in shopping lists are generally modelling starting points unless the brief fixes them explicitly. Resolve incidental generated-image differences by building one consistent model.

The floorplan is preserved in [source-floorplan.md](inn-hallway/source-floorplan.md); the project’s corresponding document is docs/inn-floorplan.html.

## Three visual treatments, plus the tiny avatar

| Asset family | Established treatment |
| --- | --- |
| Rooms and outdoor backdrops | Photographic cookbook/interiors realism: real light, materials and natural imperfections. |
| Inn inside the whisk | Gentle storybook ink, watercolour and gouache. The chosen late-afternoon illustration is the master. |
| Gemma in rooms, video references and full-size character art | Direction C: stylised 3D, adult proportions, painterly cloth, lit to belong in the photographic set. |
| Gemma’s 24px chat icon | Deliberately flat, minimal shapes: high ponytail, brass cuff, blue face, berry top and simple eyes. This exception was explicitly requested for readability. |

The Inn illustration is approved artwork, but its turret sits on the glasshouse/sea side rather than the floorplan’s hill side. Preserve the chosen illustration as artwork; follow the floorplan for the physical building. The illustration’s master is art-inbox/inn-exterior/whisk-inn-master.png in the existing project; it was produced in a separate chat.

## Shared environment language

- Cream limewashed plaster, honeyed oak, old beams, worn wide floorboards, aged brass, chipped enamel, handmade ceramics and creased linen.
- Restrained wear at contact points; readable objects and useful clearances. Rooms feel inhabited and cared for.
- Typical concept camera: full-frame 24mm, eye height about 1.6m, level verticals, 16:9 landscape, room reasonably sharp. Close-ups may use shallow depth of field.
- Light follows each room’s brief. Cuddlecore uses cool rainy afternoon daylight with warm candles/lamp; Flourish uses bright early-morning sun; Glasshouse follows its seasonal masters.
- Keep interactive hero objects distinct enough to notice within roughly three seconds. Preserve clear silhouettes and breathing space.
- Concept rooms exclude people, modern appliances/screens, logos, watermarks and garbled lettering. The approved Cuddlecore sleeping cat is intentional. Animals in later scenes need to follow that scene’s brief.
- Blender supplies clickable glows, functional lettering, real glass and its rain/condensation/reflection effects. Leave the required wall space for controls.

## Palette

These are sRGB art-direction/base-material targets. Lighting and surface texture change rendered colour.

| Shared colour or approved room accent | Hex |
| --- | --- |
| Inn cream plaster | #f4efe4 |
| Deep brown | #2c2416 |
| Shared aged brass target | #b07f52 |
| Cuddlecore dusty berry | #8b4d5c |
| Flourish marigold — later brief, current target | #d9a441 |
| Sweet Spells rose | #c27a8c |
| Chiapothecary herb green | #5c7c5c |

Glasshouse glazing is sage green; use its master and room material notes for the specific treatment. The early Flourish suggestion #d4a84b has been superseded by #d9a441.

Earlier suggestions for rooms without a completed concept pack here remain starting points for their future briefs: Cravings Decoded purple #7c5c8b and Nourish Academy teal #4a7c7c. Sweet Spells and Chiapothecary now have delivered concept packs; delivery does not imply approval of every generated detail or completion of the Blender build.

## The building stays coherent

Facing the sea from inside the front door: hill side is left; garden/sunny side is right.

| Position | Room |
| --- | --- |
| Ground floor, front left | Sweet Spells |
| Ground floor, back left | Cuddlecore |
| Ground floor, front right | Chiapothecary |
| Ground floor, back right | Flourish |
| Beside Chiapothecary, garden side | Lean-to Glasshouse |
| First floor, front | Nourish Academy |
| Turret, reached from landing | Cravings Decoded |

The entrance hall is wide and shallow across the lane/front. Stairs rise along its left side; notice board and under-stair cellar door belong there. A narrow hallway runs toward the sea window, with exactly four room doors, two per side. The grandfather clock belongs in this corridor.

Reuse the old oak four-panel door family, cream frames and round aged brass knobs. The brass navigation dial sits beside the door on the side nearer the entrance/lane; follow the room notes for which face carries it. Flourish’s inside hallway-door view has no added dial.

The navigation dial has **nine stations**: one star and eight room names, at 40° intervals. Use inn-hallway/05-dial-plate-flat.png and the separate pointer as the design authority. Generated name plates remain blank.

The Glasshouse has a different control: a **four-season wheel**, with four blank cardinal plates and leaves between them. Its face reference omits the handle so the handle can be modelled separately.

Glasshouse decisions that supersede older glimpses: sage glazing bars and terracotta square floor tiles. The latest Chiapothecary brief, acknowledged by Nicole on 18 October 2026, changes its glasshouse connecting door to GLAZED oak with clear upper panes and modest lower timber panels; this supersedes the earlier solid four-panel connecting-door decision. The separate hallway door remains four-panel oak. Use chiapothecary/03-glasshouse-door-songbird.png and chiapothecary/notes.md for this shared connection; existing glasshouse images have not been re-rendered. The glasshouse has one lean-to roof plane, glass on three sides and the house wall on the fourth. Its garden exit remains in the middle of the long glazed side.

## Coast, weather, night and seasons

The bay and headlands belong to one fictional coastline. Flourish sees the same coast from a window about five metres farther toward the garden; it has its own master framing.

For exterior backdrop images:

- No window, door, frame, glass, curtains or room in shot; rain is in the air only.
- Wide landscape, preferably the established 3:1 format, eye height about 1.6m and a level horizon near 45% up from the bottom.
- Cloud detail remains visible in overcast daylight.
- At about 11pm, land is mostly silhouette, with detail only where light reaches it. Keep the moon disc out of frame.
- No people, animals, vehicles, text, signs or logos in the established weather sets.

Rain is the daytime composition master. Generate every weather and night state directly from it, not from a previous variant. Keep the wall, garden, bay, headlands, horizon and canvas dimensions fixed. Change weather and light, and only the vegetation changes explicitly requested.

Cuddlecore and Flourish share this numbering:

| Barometer | Day | Night |
| --- | --- | --- |
| Rain | 14-window-rain.png | 19-night-rain.png |
| Fair | 15-window-fair.png | 20-night-fair.png |
| Change | 16-window-change.png | 21-night-change.png |
| Stormy | 17-window-stormy.png | 22-night-stormy.png |
| Very Dry | 18-window-very-dry.png | 23-night-very-dry.png |

Flourish’s separate garden view uses 24–28 for the five weathers and 29-garden-night.png. Its file number 13 is intentionally unused. Its garden does not yet have a seasonal set.

Glasshouse seasonal interior master: 01-to-garden-door.png; 09-spring.png is its exact copy. Outdoor master: 13-outside-spring.png. Keep glazing, door, wheel, containers and fixed furniture stationary; vary plants, light and the outside season. These are evocative coastal seasonal displays, not universal planting calendars.

Nicole has authorised deterministic size normalization and alignment. Inspect fixed visible features by flicking/cross-fading; equal image dimensions alone do not prove registration. Existing alignment reports describe measured visible patches, including their limits.

## Gemma: final character direction

Approved identity masters:

- [03-direction-c-stylised-3d-v2.png](gemma/03-direction-c-stylised-3d-v2.png)
- [08-cohost-c-stylised-3d-v2.png](gemma/08-cohost-c-stylised-3d-v2.png)

Keep the same adult face, hair, clothes and proportions: amber-brown eyes, charcoal wavy high ponytail, brass cuff/earrings, rolled-sleeve berry shirt, cream linen bib apron with pocket and front/side waist knot, and a soft blue-white steam tail.

**Every cheek stays soft blue. No rosy, red, peach or pink blush, including side views, laughter and warm lighting.** Keep the approved lip colour. Preserve a warm, intelligent, practical adult; avoid babyish proportions, sexualisation, costume stereotypes, lamps and copies of film genies.

| Gemma colour | Hex |
| --- | --- |
| Skin | #8fb8ca |
| Hair | #25232b |
| Shirt | #8b4d5c |
| Apron | #e5d9c3 |
| Brass | #b07f52 |
| Local presence glow | #e8bd72 |

Current Stage 2 assets include the latest refinements:

- 10-turnaround.png: front, side, true approximately 45° three-quarter and back; relaxed A-pose, neutral expression, even light, common scale/baseline and orthographic appearance. Plain back waistband, no extra bow.
- 11-expressions.png: eight expressions; 12-poses.png: six required actions with blue cheeks.
- 13-avatar-large.png: 1024px transparent master for 48px use.
- 14-avatar-small.png: 1024px transparent **flat icon**, simple eyes only; no detailed hair, lashes, mouth, shading of facial features or blush.
- runtime/13-avatar-48.png and runtime/14-avatar-24.png: actual-size transparent exports.
- 15-palette.png; 16-handbell.png; 17-shimmer.png; 18-whisk.png. The three icons retain the stylised 3D treatment and transparent backgrounds.

Her handbell has a turned wooden handle; it is a tea handbell. The whisk is her home. The shimmer is a small golden steam curl.

Gemma’s [notes](gemma/notes.md) and [decision](gemma/decision.json) contain the chosen design and rig guidance: independent face/eyes/brows/lids/mouth, torso/head, arms/fingers, ponytail/curls, garments/apron/ties, steam, glow and constrained props. The delivery is reference artwork and PNG assets; a Blender mesh/rig is still separate work. The ordinary home-kitchen cohost scene is a generated test setting, not a photograph of Nicole’s kitchen.

## Asset map and handoff status

Paths below are relative to art-inbox/. Files delivered here do not by themselves prove the Blender/browser implementation is complete. Nicole reported Cuddlecore built/live and hallway/magic door built.

| Pack | Main reference / notes |
| --- | --- |
| Cuddlecore | [01-front-wall.png](cuddlecore/01-front-wall.png), [09-materials-moodboard.png](cuddlecore/09-materials-moodboard.png), [notes](cuddlecore/notes.md) |
| Cuddlecore weather/night | [Rain master](cuddlecore/14-window-rain.png), [weather notes](cuddlecore/weather-notes.md), [night notes](cuddlecore/night-notes.md) |
| Hallway/magic door | [02-hallway-to-sea.png](inn-hallway/02-hallway-to-sea.png), [notes](inn-hallway/notes.md), [layout](inn-hallway/layout.json) |
| Glasshouse | [01-to-garden-door.png](glasshouse/01-to-garden-door.png), [notes](glasshouse/notes.md), [gallery](glasshouse/gallery.html) |
| Flourish | [01-table-sea-window.png](flourish/01-table-sea-window.png), [notes](flourish/notes.md), [gallery](flourish/gallery.html) |
| Sweet Spells | [01-table-bay-window.png](sweet-spells/01-table-bay-window.png), [notes](sweet-spells/notes.md), [gallery](sweet-spells/gallery.html); 23 selected images including shared lane weather/night 14–23. |
| Chiapothecary | [01-counter-drawers.png](chiapothecary/01-counter-drawers.png), [notes](chiapothecary/notes.md), [gallery](chiapothecary/gallery.html); 13 selected images, 40-drawer cabinet, glazed glasshouse connection. Reuses Sweet Spells lane set. |
| Gemma | Approved v2 masters above; [current Stage 2 gallery](gemma/stage2-gallery.html) and [notes](gemma/notes.md) |
| Storybook exterior | Existing-project art-inbox/inn-exterior/whisk-inn-master.png and its README; separate-chat asset |

Cuddlecore’s cable-knit and rag-rug files are explicitly named **tile-candidate** and still require seam cleanup; do not pass them off as verified seamless. Flourish’s runner and tea-towel repeats have separate tile-check records.

Sweet Spells’ damask and Chiapothecary’s wrapping paper/optional encaustic floor have 2×2 repeat previews and numerical seam diagnostics. These are visually checked colour/pattern assets, not calibrated complete PBR maps or mathematically periodic microtextures. The shared village lane is 2172 × 724; sampled fixed-feature matches measured 0–2 pixels of local variation, with limits in sweet-spells/alignment-report.json. Do not claim exact pixel identity across generated weather edits.

For each new pack, preserve requested filenames, retain the master, include exact prompts and a props/materials list, and document any unresolved issue. Keep labels blank for Blender text. Verify repeat seams, transparency and small-size readability as applicable. For tightly scoped corrections, check that unrelated assets remain unchanged.

Typography, a new logo system and a broader interface redesign have not been selected in this art sequence. Keep the existing site treatment unless a future brief asks to develop those.

