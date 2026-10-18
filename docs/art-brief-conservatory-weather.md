# WhiskedAway: ChatGPT brief #10, the Conservatory in wet weather and at night

The glasshouse is being renamed **the Conservatory**. This brief uses the new name. The files
still go in `art-inbox/glasshouse/`, the folder the earlier views are in.

The Conservatory is getting the barometer and the clock, like the kitchen and the hallway: five
weathers, by day and by night, in each of the four seasons. Claude builds the glass, the rain on
it and the light inside in Blender. What Blender can't make is the garden outside, so we need
**eight new views of the garden**, two per season:

- **a wet, overcast garden**, used for both rain and storm (Blender adds the heavier rain on the
  glass and the darker sky for a storm);
- **the garden at night**, used for all five weathers at night (Blender adds the rain and storm
  on the glass).

Fair, changeable and very dry days reuse the four views we already have (13 to 16).

## The rule that matters most

Every new view must line up **exactly** with the views we already have: same camera, same
horizon, the same stones in the low wall, the same gap in the wall, the same path, the same
elder, the same headlands. Only the weather, the light and the plants' wetness change. If
anything moves, the Conservatory's views will jump when they cross-fade.

## What to attach

Start a **new ChatGPT conversation** and attach:

1. `art-inbox/glasshouse/13-outside-spring.png`: **the composition master**. Every new view is an
   edit of the right season's view, but this one sets the framing.
2. `art-inbox/glasshouse/14-outside-summer.png`
3. `art-inbox/glasshouse/15-outside-autumn.png`
4. `art-inbox/glasshouse/16-outside-winter.png`
5. `art-inbox/cuddlecore/14-window-rain.png`: the kitchen's rainy view, as a **mood reference**
   for rain at the Inn (not for framing).
6. `art-inbox/cuddlecore/20-night-fair.png`: the kitchen's night view, as a **mood reference**
   for how dark night should be (not for framing).

## Prompt W1: set up (paste first, with the six images attached)

> I'm art-directing a photoreal 3D environment for a cooking website called WhiskedAway: an old
> inn on a headland above the sea. One room is a Victorian lean-to conservatory. Its glass walls
> look out on a coastal herb garden, and the attached images 1 to 4 are the view outside the
> glass in spring, summer, autumn and winter. They are backdrop plates: ultrawide 3:1
> photographs taken from inside the doorway at eye height (1.6 m), with no glass, frame or
> conservatory in shot. Image 1 is the composition master.
>
> I need the same view in new weather and at night. For every image in this conversation:
>
> - **Edit the season's own image. Never reframe.** Same 3:1 ultrawide size, same camera, same
>   horizon height (about 55% down from the top), the same stones in the low dry-stone wall,
>   the same gap in the wall, the same gravel path, the same elder (left of the path) and the
>   same headlands and bay. Only the weather, the light and wetness change.
> - **Photographic**, like the attached views: a real photograph, not CGI or illustration.
> - **Never include:** glass, glazing bars, window frames, reflections, raindrops on a lens,
>   text, lettering, people, animals, buildings, cars or fences.
> - Images 5 and 6 are mood references from another room of the same inn: how rain and night
>   look there. Don't copy their framing.
>
> Reply with a short summary. Don't make an image yet.

## Prompt W2: the wet, overcast garden (four images)

Edit **the matching season's image** each time (spring from 1, summer from 2, autumn from 3,
winter from 4), never the previous wet image:

> "Edit image [N], the [season] view. Exact same framing, nothing moved, but on a **wet,
> overcast day**: [weather]. Keep every wall stone, the path, the elder and the headlands
> exactly where they are."

| File | Season, from image | [weather] |
|---|---|---|
| `20-outside-spring-wet.png` | Spring, from 1 | "soft steady spring rain under low grey cloud, the bay pewter-grey with rain on it, the headlands half lost in mist, the gravel path dark and wet with small puddles, the herbs heavy and shining with water, the elder's cream flowers drooping" |
| `21-outside-summer-wet.png` | Summer, from 2 | "a grey summer downpour, warm and heavy: dark cloud, the sea flattened and grey, rain visible as fine streaks against the hills, puddles on the path, lavender and borage bowed with water" |
| `22-outside-autumn-wet.png` | Autumn, from 3 | "a cold autumn rain blowing in off the sea: heavy slate cloud, a rough grey sea with white caps, wet fallen leaves on the path, the elder's berries dark and dripping" |
| `23-outside-winter-wet.png` | Winter, from 4 | "a raw winter rain: very low cloud, sleety drizzle, the sea dark and choppy, the bare elder black with wet, the path muddy, brown seed heads sodden" |

**Keep it overcast and soft.** No sun, no shadows, no lightning, no dramatic storm: Blender
makes the storm. If ChatGPT adds sunshine or a storm, ask: "Softer. Overcast and wet, no sun,
no storm."

## Prompt W3: the garden at night (four images)

Again, edit the matching season's image each time:

> "Edit image [N], the [season] view. Exact same framing, nothing moved, but **at night, about
> 11pm**: [night]. It's genuinely dark, like image 6: the garden and wall mostly silhouette, with
> detail only where there's light. No moon in the sky itself."

| File | Season, from image | [night] |
|---|---|---|
| `24-outside-spring-night.png` | Spring, from 1 | "a mild, still spring night, a few stars, the faint last blue on the horizon, two or three warm cottage windows across the bay, the elder's pale flowers just catching the light" |
| `25-outside-summer-night.png` | Summer, from 2 | "a clear, warm summer night, stars over the sea, moonlight on the water (moon out of frame), a warm cottage window or two across the bay" |
| `26-outside-autumn-night.png` | Autumn, from 3 | "a cool autumn night with broken cloud, a little moonlight through it (moon out of frame), a lighthouse light on the far headland, the sea dark" |
| `27-outside-winter-night.png` | Winter, from 4 | "a cold, clear winter night, sharp stars, frost on the grass and the wall stones glinting faintly, the bare elder a black silhouette, one warm window across the bay" |

**Keep them dark.** If ChatGPT makes it look like dusk: "Darker. This is 11pm: most of the land
should be silhouette."

## Check before saving

Flick between each new image and its season's original (for example `20-outside-spring-wet.png`
against `13-outside-spring.png`). The wall, the gap, the path, the elder and the headlands must
not move. If anything shifts, ask: "The composition shifted. Redo it matching image [N] exactly."

Also check:

- [ ] Eight images, 3:1 ultrawide, the same size as views 13 to 16
- [ ] Wet views: overcast, soft, no sun, no storm, no lightning
- [ ] Night views: properly dark, no moon in frame
- [ ] No glass, frames, reflections, raindrops on a lens, text, people or animals
- [ ] Saved in `art-inbox/glasshouse/` with the file names above

Claude then builds the five weathers by day and night in Blender: fair, changeable and very dry
from views 13 to 16, rain and storm from 20 to 23, and every night from 24 to 27.
