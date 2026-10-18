# WhiskedAway: ChatGPT brief #7, Gemma

Gemma is the kitchen genie who hosts WhiskedAway. She needs a look that works everywhere she
appears: beside the photoreal rooms, in the 90s chat window, in the welcome message and its little
handbell, and next to Nicole as co-host of the WhiskedAway cooking show on YouTube.

Today she is a small pixel avatar based on Microsoft's Fluent "woman genie" emoji (MIT licensed).
It works in the chat window, but it isn't her own design, and it looks pasted on beside the rooms.
A design made for WhiskedAway would be Gemma's alone.

This brief has **two stages**:
1. **Directions:** the same Gemma in five different styles, each shown in the Cuddlecore kitchen,
   so Nicole can see which one belongs there.
2. **The chosen Gemma:** once Nicole picks a direction, a turnaround, expressions, poses, the
   chat-window avatar and a few small icons.

Stop after stage 1 and wait for Nicole's choice.

**Chosen 18 October 2026: Direction C, stylised 3D**, as in `art-inbox/gemma/03-direction-c-stylised-3d-v2.png`
(the version with the cheek blush toned down). Paste the stage 2 message below into the same ChatGPT conversation.

### Stage 2 message

> We're going with **Direction C, the stylised 3D Gemma**, exactly as she is in
> `03-direction-c-stylised-3d-v2.png` and `08-cohost-c-stylised-3d-v2.png`: the same face, hair,
> clothes and proportions. Keep her cheeks soft blue like the rest of her skin, with no rosy blush,
> in every image. Please make stage 2 from the brief (Prompts G3 to G6) in this order:
>
> 1. **The turnaround** (`10-turnaround.png`), with one change: she'll be built as a 3D model in
>    Blender, so make it a **modelling reference**: relaxed A-pose, neutral expression, front, side,
>    three-quarter and back, no perspective distortion, all at the same scale on one baseline,
>    plain background, even light.
> 2. **Expressions** (`11-expressions.png`) and **poses** (`12-poses.png`).
> 3. **The avatar** at large and small sizes (`13-avatar-large.png`, `14-avatar-small.png`),
>    transparent background.
> 4. **The palette card** (`15-palette.png`), with the hex values in your notes.
> 5. **The three icons**, handbell, shimmer and whisk (`16` to `18`), transparent backgrounds,
>    in the same stylised 3D look.
>
> Update `notes.md` and `decision.json` with the choice, and note which parts of her would move
> separately for a 3D rig.

---

## Who Gemma is

From her constitution (the instructions the AI follows when it speaks as her):

- **Warm, caring and practical**, like a friend who shows up with soup when you're sick.
- Encouraging, never preachy or judging. She celebrates small wins: "Toast counts. You're eating.
  That's the win."
- A **kitchen genie**: her home is the whisk, the way a genie's is a lamp. The Inn itself sits
  inside a giant whisk in the storybook picture.
- She reads what you do rather than what you type, and offers, never pushes.

**Keep her recognisable** across every direction, so it's clearly one character in five styles:
- A genie, with the soft **blue skin** of today's avatar.
- **Dark hair in a high ponytail** or top-knot.
- A **dusty berry (#8b4d5c)** top, the Cuddlecore accent, with **aged brass (#b07f52)** details.
- Kitchen clothes rather than costume: rolled sleeves, an apron or a tea towel over her shoulder.

**Avoid:** the "harem" or Arabian-nights costume stereotype (veils, midriff, curled slippers, a
lamp), anything sexualised, a cartoonish or babyish look, and copying any existing film genie.
She's an adult, a cook, and someone you'd trust.

## What to bring back

Save into `whiskedaway-react/art-inbox/gemma/`:

**Stage 1**

| File | What |
|---|---|
| `01-direction-pixel.png` | Direction A, refined pixel art |
| `02-direction-storybook.png` | Direction B, storybook painting |
| `03-direction-animated-3d.png` | Direction C, stylised 3D film character |
| `04-direction-hand-drawn.png` | Direction D, hand-drawn 2D animation |
| `05-direction-presence.png` | Direction E, a shimmer more than a person |
| `06-directions-sheet.png` | All five side by side, same pose, on a plain background |
| `07-on-camera-test.png` | The two strongest directions beside a real (photographed) home kitchen counter |

**Stage 2** (after Nicole picks)

| File | What |
|---|---|
| `10-turnaround.png` | Front, three-quarter, side and back, same scale |
| `11-expressions.png` | Eight expressions (see Prompt G4) |
| `12-poses.png` | Six poses (see Prompt G4) |
| `13-avatar-large.png`, `14-avatar-small.png` | The chat-window avatar (see Prompt G5) |
| `15-palette.png` | Her colours, with hex values in the notes, not in the image |
| `16-icon-handbell.png`, `17-icon-shimmer.png`, `18-icon-whisk.png` | Small icons, transparent backgrounds |

Also write `notes.md`: the chosen direction, her proportions and colours, and anything the
animation needs to know (which parts move separately).

**Attach these images** at the start of the conversation:
- `art-inbox/cuddlecore/01-front-wall.png`, the Cuddlecore kitchen (the room she'll stand in)
- `art-inbox/inn-exterior/whisk-inn-master.png`, the Inn in the whisk (direction B's style, and her home)
- `blender/explore/assets/gemma-pixel.png`, today's avatar (for her colours and hair, not her design)

## Prompt G1: character lock (paste first, with the three images attached)

> I'm designing the host character for a cooking website called WhiskedAway. The site is an old
> countryside inn on a headland above the sea, held inside a giant whisk the way a genie is held
> in a lamp (second attached image). Each room is a photoreal kitchen you can look around (first
> attached image). The host is **Gemma, a kitchen genie**: warm, caring and practical, like a
> friend who shows up with soup when you're sick. She encourages, never judges, and celebrates
> small wins.
>
> The third image is the tiny placeholder avatar she has now, borrowed from an emoji set. Use it
> only for her colours and hair. I want her **own** design. Please keep these in every image:
>
> - An adult woman genie with soft **blue skin** and **dark hair in a high ponytail**.
> - Kitchen clothes, not costume: a **dusty berry (#8b4d5c)** top with rolled sleeves, a linen
>   apron or a tea towel over one shoulder, small **aged brass (#b07f52)** details (a hair cuff,
>   an earring, a bangle).
> - Her lower half can trail into a soft swirl of steam, like a genie's, or she can have legs.
>   Show me whichever suits each style.
> - A kind, intelligent face, mid-thirties to forties. Someone you'd trust with your dinner and
>   your bad day.
> - **Never:** the Arabian-nights costume stereotype (veils, bare midriff, curled slippers, an oil
>   lamp), anything sexualised, babyish proportions, or a copy of any film genie. No text,
>   logos or watermarks.
>
> Reply with a short summary of the character. Don't make an image yet.

## Prompt G2: five directions (stage 1)

Use **the same pose for all five**: Gemma beside the range in the Cuddlecore kitchen (the first
attached image), turned a little toward the viewer, one hand lifted in welcome, a wisp of steam
from the pot curling toward her. Composite her into that kitchen photo each time, at a believable
size, lit by the room's rainy window light and candlelight.

> "Direction A, **pixel art**: a refined, larger pixel-art Gemma in the spirit of 1990s computer
> games, about 64 pixels tall, crisp pixels, limited palette, placed in the kitchen photo as if
> she were a sprite on top of it."

> "Direction B, **storybook painting**: Gemma painted in the same style as the attached picture
> of the Inn in the whisk: gentle ink lines, soft watercolour and gouache. Placed in the kitchen
> photo like an illustration that has stepped into the real room."

> "Direction C, **stylised 3D animated film character**: soft, appealing proportions, painterly
> textures, lit to match the kitchen exactly so she looks like she belongs in the photo."

> "Direction D, **hand-drawn 2D animation**: classic cel-style line and flat colour with soft
> shading, warm and expressive, composited over the kitchen photo."

> "Direction E, **a presence more than a person**: a warm golden shimmer of steam rising from
> the pot, in which Gemma's face and one hand are only half-formed, glowing softly. Still
> recognisably her (the ponytail, the berry, the brass)."

Then:
- "Now all five Gemmas **side by side** on a plain warm-cream background, same pose, same height,
  labelled only by position (no text)."
- "Now the **two directions that worked best**, each placed beside the counter of an ordinary,
  real, photographed home kitchen in daylight, at the size she'd appear next to a person standing
  at the counter (leave the person out). This tests how she'd look as co-host in a cooking video."

**Stop here** and let Nicole choose.

## Prompt G3: the turnaround (stage 2)

> "We're going with Direction [X]. Make a **character turnaround**: Gemma front, three-quarter,
> side and back, standing in a neutral pose, all at the same scale and on the same baseline,
> plain warm-cream background, even light, no text."

## Prompt G4: expressions and poses

> "An **expression sheet**, head and shoulders, eight expressions in a 4 × 2 grid, same angle and
> scale: (1) welcoming hello, (2) listening, (3) thinking it over, (4) delighted, (5) gentle
> concern, (6) laughing, (7) a little 'oops', (8) sleepy, late at night. Plain background, no text."

> "A **pose sheet**, full figure, six poses in a 3 × 2 grid: (1) rising out of a swirl from a
> whisk, (2) pointing toward something off to the side, (3) holding out a steaming bowl,
> (4) stirring a pot, (5) ringing a tiny brass handbell, (6) waving goodbye. Plain background,
> same scale, no text."

## Prompt G5: the chat-window avatar

The chat window is small and square, so Gemma needs a version that reads at a glance:

> "Gemma's **avatar**: head and shoulders, welcoming expression, square, centred, on a plain
> **transparent** background. It must still read clearly when shrunk to 48 × 48 pixels: bold
> shapes, simple shading, her ponytail and berry top easy to see. Make it at 1024 × 1024."

Then: "The same avatar, simplified further for **24 × 24 pixels**: just her silhouette, ponytail
and colours." Save as `13-avatar-large.png` and `14-avatar-small.png`.

## Prompt G6: palette and icons

> "A **palette card** for Gemma: her skin, hair, berry top, apron, brass, and the glow she gives
> off, as swatches on a plain background, no text." (Ask ChatGPT to list the hex values in its
> reply, for `notes.md`.)

Three small icons, each **flat, front-on, transparent background, 1024 × 1024**, in Gemma's chosen style:
- "A **tiny brass handbell** with a turned wooden handle, the kind once rung to call for tea. Not a
  hotel desk bell." This is the welcome message's help bell, top right of every room.
- "A **shimmer**: a small swirl of golden sparkle and steam. Gemma's sound and her 'I'm here' mark."
- "A **whisk**, simple and elegant, brass and wire, slightly magical. Gemma's home."

---

## Things for Nicole to weigh when choosing

Each style is a different amount of work to animate on the site and in videos:

| Direction | How it would move |
|---|---|
| A, pixel | Easiest. Short sprite animations (blink, wave, bounce), like today's blink. |
| B, storybook | Gentle. A few painted poses that cross-fade, plus small moves (breathing, a hair sway). |
| C, 3D | The most lifelike and the most work: a full Blender character with a rig. Could appear inside the rooms and in fly-throughs. |
| D, hand-drawn | Moderate. Layered parts animated in the browser (eyes, mouth, arms). Expressive. |
| E, presence | Easy and very atmospheric. Glow and steam move well; less room for expression. |

A mix is possible too: one style in the rooms and a simpler one for the chat avatar.

## Checklist

- [ ] Recognisably the same Gemma in all five directions (blue skin, dark ponytail, berry, brass)
- [ ] No costume stereotype, nothing sexualised, no lamp, not a copy of a film genie
- [ ] She looks like she belongs in the Cuddlecore kitchen, not pasted on
- [ ] The avatar still reads at 48 × 48 pixels
- [ ] The icons have transparent backgrounds and no text
- [ ] No readable text or garbled lettering anywhere
