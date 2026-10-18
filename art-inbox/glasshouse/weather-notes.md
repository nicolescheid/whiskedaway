# The Conservatory — wet weather and night

Brief #10 · 19 October 2026

The room is now **the Conservatory**. Its existing asset folder remains `art-inbox/glasshouse/`. This pack adds eight photographic outdoor backdrop plates, numbered 20–27. The four approved seasonal originals, 13–16, remain unchanged.

## Files and use

| Season | Fair, changeable, very dry DAY — existing | Rain and storm DAY — new | ALL FIVE weathers at NIGHT — new |
| --- | --- | --- | --- |
| Spring | 13-outside-spring.png | 20-outside-spring-wet.png | 24-outside-spring-night.png |
| Summer | 14-outside-summer.png | 21-outside-summer-wet.png | 25-outside-summer-night.png |
| Autumn | 15-outside-autumn.png | 22-outside-autumn-wet.png | 26-outside-autumn-night.png |
| Winter | 16-outside-winter.png | 23-outside-winter-wet.png | 27-outside-winter-night.png |

All eight PNGs are **2170 × 725 pixels**, matching the actual seasonal originals. This is approximately 3:1; the originals are not an exact mathematical 3:1 canvas. No crop was made to force a different ratio.

## Image direction

Spring wet has steady fine rain, grey cloud, a pewter bay, mist-softened headlands, dark wet gravel and small puddles. The cream elder flowers and herbs carry water. Summer wet is a warm grey downpour, with fine airborne rain, a flat grey bay, puddles and water-heavy lavender and borage. Autumn wet has cold rain blowing off the sea, slate cloud, modest whitecaps, wet leaves and dark elder berries. Winter wet has low cloud and sleety drizzle, a choppy dark bay, wet bare branches, muddy gravel and sodden seed heads. All are softly overcast, without sunshine, hard sun shadows, lightning or a dramatic storm.

The four nights are dark, around 11pm, with most land and wall in silhouette. Spring retains a faint blue horizon, pale flowers and three tiny warm light points on the distant right shore. Summer has stars and a restrained moonlit shimmer on the water. Autumn has broken cloud, faint moonlight and a tiny lighthouse light on the far headland. Winter has sharp stars, sparse frost glints, a black bare elder and one distant warm light. There is no moon disc or visible new building/tower. Water glimmer is natural illumination, not a glass reflection.

## Preserved scene and materials

Each edit starts from its own season's original, with spring 13 governing the established framing. Preserved elements include the low dry-stone wall and its gap, the gravel path, the elder left of the path, coastal herbs and seed heads, the headlands, bay and horizon. Existing material families are rough grey stone, gravel/earth, seasonal foliage, sea and sky. Wet variants change surface wetness and modest plant droop; winter night adds faint frost. There are no glass panes, glazing bars, frames, lens droplets, lettering, people, animals, vehicles or fences baked into the plates.

## Blender handoff

Use the same backdrop mesh, UVs, camera and placement as views 13–16. Do not independently auto-crop or fit each image. The wet plate serves both rain and storm; Blender supplies the heavier rain on the glass and darker storm sky. Each seasonal night plate serves all five night weathers; Blender supplies weather on the glazing. Glass, reflections, conservatory structure and interior light stay in Blender. The barometer and clock select these states; this image pack does not implement those controls.

Treat the PNGs as colour images. Compare cross-fades in the actual room at its intended exposure, with the same colour handling for both endpoints. Avoid lifting the night garden into bright blue-hour daylight.

## Alignment and verification

Final images were visually inspected and cross-faded against their matching seasonal originals. Ten visible regions were sampled: three wall regions, both sides of the gap, path, elder trunk/crown and both headlands. Final reliable matches measured **0–1 pixel offset**. Low-confidence path or frost-obscured matches remain identified in `weather-alignment-report.json`.

These are sampled measurements, not proof of exact identity for every stone, branch or pixel. Generative weather edits can retain small local texture differences. The gallery provides original/variant buttons, a cross-fade slider and optional flicker for review. Full-resolution PNGs are linked from every card.

Technical finishing follows the existing art direction's authorization for deterministic size normalization and alignment. Most generated files were 2169 × 725; they were normalized horizontally to the originals' 2170 × 725. Seven selected images then received small whole-image integer translations (up to three pixels), with replicated edge pixels. Summer wet's selected redo needed normalization only. There was no local warp, creative scripted painting, compositing or change to the original masters. `weather-registration.json` records each translation. All creative weather/time edits used the built-in image generation tool.

Winter wet, spring night, winter night and summer wet were regenerated after comparisons caught drift. Spring night and summer wet used a detail crop of their own original headland as an additional geometry reference. The crops did not set output framing. Superseded attempts and full prompts are recorded in `weather-prompts.json`; only the selected eight PNGs are delivered as production assets.

## Pack contents

- Eight full-resolution PNGs, numbered 20–27.
- `weather-gallery.html`: comparison gallery using lightweight previews; controls affect previews only.
- `weather-contact-sheet.jpg`: four seasonal rows, original / wet / night.
- `weather-prompts.json`: exact prompts, references, generated-source paths and selected redo records.
- `weather-asset-manifest.json`: checksums, dimensions, reference provenance and runtime mapping.
- `weather-alignment-report.json` and `weather-registration.json`: measured checks and technical finishing.
- `weather-references/`: unchanged copies of the six supplied masters/mood references, plus the two original headland detail crops.
- `weather-preview/`: lightweight comparison previews.

Copy the new numbered PNGs into the existing `art-inbox/glasshouse/` folder. This pack's supporting filenames are prefixed `weather-` to avoid replacing the existing room gallery and notes. Preserve original assets 13–16 and the existing interior pack.
