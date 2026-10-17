# Cuddlecore window weather set
WhiskedAway — brief #2

Five exterior backdrops for the same kitchen window, saved beside the concept pack.

| Barometer | File | Weather |
|---|---|---|
| Rain | 14-window-rain.png | Wet garden, light rain, detailed low cloud and coastal mist. |
| Fair | 15-window-fair.png | Warm summer daylight, blue sky, dry fields and sparkling blue-green sea. |
| Change | 16-window-change.png | Quiet pearly morning with sea fog partly hiding the headlands. |
| Stormy | 17-window-stormy.png | Heavy cloud, diagonal airborne rain, wind and white-capped waves. |
| Very Dry | 18-window-very-dry.png | Golden late-summer fields, pale hazy sky and calm glassy sea. |

## Image format
All five final PNGs are **2172 × 724 pixels**, **3:1 landscape**, RGB. They have identical canvas dimensions and are registered against the rainy master. No frame, room, curtains, glass, glass droplets or text are part of the images. Atmospheric rain is present in Rain/Stormy; window-glass streaks remain the 3D scene's responsibility.

The distant open-sea horizon is about 58% down from the top (42% up from the bottom), close to the requested approximate 45% from the bottom. The same garden wall, bay and headlands anchor all five versions.

01-front-wall.png supplied the photographic Cuddlecore look; 10-coastal-map-flat.png supplied the fictional coast's fields, sheltered bays and headlands. The optional dusk version is left for later.

## Matching and review
The rainy image is the fixed composition master. Each other weather was generated as an edit of that same image rather than an edit of the preceding weather.

With your authorization, generated size differences were normalized and small shifts were aligned using stable terrain, stone-wall and shrub features. Sky and sea were excluded from alignment fitting because clouds/waves change with weather.

Across the four variants:
- 32–65 stationary patches matched in the final checks.
- Median measured displacement is 0.13–0.19 pixel; the 95th-percentile displacement is 0.28–0.59 pixel.
- Those numbers describe visible matched patches, not every pixel or the fog-obscured headlands. Rain, mist, cloud, waves and grass tips differ intentionally.
- Side-by-side terrain comparisons were inspected. Use weather-preview.html to flick between rainy master and any other state, cross-fade or compare side by side.
- Exact measurement details are in weather-alignment.json; generation/revision prompts are in weather-prompts.json.

## Blender placement
- Use one backdrop plane (or gently curved backdrop) a few metres behind the existing window. Keep its position and UV mapping identical for every weather.
- Set plane width to three times its height. For example, a 9 m × 3 m plane is a starting point; adjust its distance/scale together to fill the window from the room's intended viewing positions.
- Center the intended bay/garden composition in the window and check the widest left/right viewing angles before finalizing the plane. Keep extra image width available beyond the opening.
- Use these RGB PNGs as color imagery with consistent color-space settings across the five states. Match backdrop brightness to the kitchen exposure and selected weather.
- Drive image selection or mixing on the same UVs from the barometer. Cross-fade the images; keep geometry, texture scale and camera fixed.
- Keep the existing 3D window-rain setup separate. Fade those streaks/rain effects appropriately for Fair, Change and Very Dry.
- A plane provides a window view rather than full outdoor parallax. Check it from the actual navigation range; a curved backdrop may help at broad viewing angles.
- No 3D scene was changed in this delivery.

## Preview and package
weather-preview.html is a local review page with weather controls, a rainy-master overlay and side-by-side comparison. weather-contact-sheet.jpg is a compact overview.

The ZIP preserves whiskedaway-react/art-inbox/cuddlecore/ and includes these five images plus weather-specific notes, prompts, measurements and previews. The original 13-image concept ZIP is unchanged.

Generation used the built-in image tool. Alignment used local Pillow/NumPy after your explicit approval. The generated source images remain preserved in the image tool's original output location.

