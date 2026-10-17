# Cuddlecore window at night — brief #3

Five approximately 11pm versions of the same coast, each made directly from **14-window-rain.png**, never from a previous night image.

| Barometer | Night file | Corresponding daytime file |
|---|---|---|
| Rain | 19-night-rain.png | 14-window-rain.png |
| Fair | 20-night-fair.png | 15-window-fair.png |
| Change | 21-night-change.png | 16-window-change.png |
| Stormy | 22-night-stormy.png | 17-window-stormy.png |
| Very Dry | 23-night-very-dry.png | 18-window-very-dry.png |

All five final night PNGs are **2172 × 724**, **3:1**, RGB, with matching dimensions and alignment against the same daytime rainy master used by the weather set.

## Night direction
- **Rain:** dark low cloud faintly lit by a distant town beyond the headland; steady airborne rain, sparse warm cottage windows, a little light on wet stone.
- **Fair:** dark clear summer night, natural stars, faint horizon glow, moonlight on the water; moon remains outside the image.
- **Change:** dark sea fog, bay obscured, cottage lights blurred into haloes, garden wall barely visible.
- **Stormy:** heavy dark cloud, sideways rain, white surf, one narrow lighthouse beam from the far headland. This is a still image of one moment in a sweep, not an animated beam.
- **Very Dry:** deep blue-black sky, a very faint last trace of dusk along the horizon, dark flat sea, warm windows and a little silver light on dry grass.

Land remains mostly silhouette. There is no moon disc, window/frame/glass, glass rain streaks, text, people or animals. Rain is in the air; the kitchen's existing glass-rain effect remains separate.

## Alignment and darkness checks
The image tool produced slight dimension and framing differences. Using the deterministic normalization/alignment you previously authorized, final files were resized to the original canvas and given small affine corrections based on fixed stone-wall, shrub and land features. Daytime files were not changed.

Final visible-patch checks:
- 22–57 stable patches matched per night image.
- Median measured displacement: **0.15–0.31 px** against the daytime rainy master.
- 95th-percentile displacement: **0.38–0.89 px**.
- These measures apply to matched visible features, not every pixel or silhouettes hidden by fog. Clouds, rain, water, surf, fine grass tips and the requested lights change intentionally.
- Terrain comparisons were inspected with a temporary brightness boost to reveal alignment. This boost is not applied to any delivered PNG.
- Within the land/shrub inspection mask, median 8-bit grayscale values are **10–16 out of 255**; **83–89%** of masked pixels are below 32/255. These are file-value checks, not scene luminance measurements.

See night-alignment.json for measurements and night-prompts.json for exact generation prompts.

## Using the clock and barometer in Blender
Keep the existing backdrop geometry, UV mapping and texture scale fixed for all ten day/night-weather images. The clock selects or mixes day and night; the barometer selects weather. Use the same image color-space and material settings throughout.

Preserve the night images' low exposure. Judge them through the window with the kitchen's existing lighting and exposure; avoid automatically lifting each image's shadows. Adjust scene integration only after checking how the room and backdrop read together.

Rain and Stormy contain airborne rain; control the separate 3D rain-on-glass effect with the weather as appropriate. The star fields, cottage windows and lighthouse beam are baked into these still backdrops.

No Blender scene was modified in this delivery.

## Preview and package
Open **night-preview.html** to select a weather, flick or cross-fade against the daytime rainy master, compare side by side, or use the optional inspection brightness boost. The boost changes the preview only. You can also compare night weathers against the rainy night image.

The ZIP preserves **whiskedaway-react/art-inbox/cuddlecore/**. It includes the five new night images, the unchanged daytime rainy master for a self-contained comparison, this note, prompts, alignment measurements, preview and contact sheet. Earlier concept and daytime weather ZIPs are unchanged.

Generation: built-in image tool. Post-processing: locally authorized dimension normalization and geometric alignment with Pillow/NumPy. Original image-tool outputs remain preserved at their generated locations.

