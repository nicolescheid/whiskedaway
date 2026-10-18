# Gemma — Stage 1 direction study

**Decision: pending Nicole's choice.** This pack stops at Stage1. No turnaround, expression/pose sheets, production avatars, palette-card image or icons have been made.

## The same Gemma

An original adult kitchen genie, around38–42: warm, intelligent and practical. She welcomes without crowding. She looks like someone who can make dinner and notice that a small win counts.

Shared design anchors: muted blue face/hands, charcoal dark high ponytail with a small aged-brass cuff, dusty berry shirt with sleeves rolled to elbows, cream linen bib apron and useful pocket. Small brass stud earrings. One hand opens in welcome; the other rests by the apron pocket. Her lower apron gives way to a gentle steam curl.

Aim for an apparent adult height around1.65 m beside the range. Keep human adult head/torso/hand proportions; the steam tail is not a reason to enlarge the head or give her a childlike torso. Allow tiny expression lines and a lived-in face.

The supplied pixel placeholder informed colour/hair cues only. The face, practical costume and silhouette in this pack are a new design study. The Inn-in-whisk picture informs B's painting style and the world she inhabits.

## Directions

| Position / file | Treatment | What to judge |
| --- | --- | --- |
| A /01 | Refined90s pixel sprite, about64 source pixels high in intent, displayed larger over the photo | Chat-window continuity, clear silhouette, and whether the deliberate sprite/photo contrast belongs beside the rooms |
| B /02 | Gentle ink, watercolour and gouache, matching the illustrated Inn | Warmth and continuity with the whisk-world; whether a painted character feels present in a real room |
| C /03 | Stylised3D adult with painterly materials, lit to match the room | Spatial presence, readable acting and the balance between appealing stylisation and a credible adult |
| D /04 | Hand-drawn2D cel line/colour with restrained shading | Expressiveness, clarity and whether flat colour can share the room's light convincingly |
| E /05 | Mostly translucent golden steam, half-formed face and welcome hand | A subtle host presence, recognisability and how much expression survives when most of her is absent |

06 is the plain warm-cream lineup, ordered **A, B, C, D, E from left to right**, with no lettering in the image. It is a comparison image, not a production model sheet.

07 and08 are the two shortlisted co-host tests: B storybook and C stylised3D. They use one generated photographic daylight home-kitchen setting, no person, so the character's scale and relationship to a working counter are easy to compare. These are visual mockups, rather than photos of Nicole's actual kitchen or footage from the show.

B is shortlisted for its continuity with the painted Inn-in-whisk world; C for its response to room light and potential for spatial acting. Neither is selected on Nicole's behalf.

## Provisional colours

These are art-direction targets, not a final approved palette or measured samples of every rendered pixel:

| Part | Target |
| --- | --- |
| Skin | Soft muted blue #8fb8ca |
| Hair | Charcoal #25232b |
| Rolled-sleeve shirt | Dusty berry #8b4d5c |
| Linen apron | Warm cream #e5d9c3 |
| Brass details | Aged brass #b07f52 |
| Steam | Pale blue-grey / cream, transparent edges |
| Presence glow | Soft local gold, around#e8bd72; never an opaque yellow body |

Room lighting deliberately shifts local colours: cool rainy-window light and warm candlelight in the Cuddlecore tests; daylight in co-host tests. Keep those shifts rather than painting the same flat RGB values onto every lit surface.

## Animation implications — provisional

| Direction | Likely implementation | Main effort / risk |
| --- | --- | --- |
| A | Discrete pixel frames with nearest-neighbour display; separate face/hand/tail frames if useful | Restrained motion can be economical. New gestures and expressions need carefully redrawn pixels; readability at48px must be designed and tested in Stage2. |
| B | Layered2D cutout rig with painted parts and limited hand/face redraws | Preserve brush texture through bends. Large rotations can expose missing painted surfaces; subtle acting will suit the style. |
| C |3D character rig with facial shapes, hand controls and secondary hair/apron motion | Greatest modelling/rig setup. Once built, offers reusable poses, camera angles and scene lighting for room and video work. No3D mesh/rig is included in this PNG study. |
| D |2D cutout or frame animation with separate expressions and hands | Needs consistent line weight, mouth/eye shapes and redraws at extreme angles. Shadow treatment should stay consistent with photographic backgrounds. |
| E | Layered steam/particle effects with a controlled face/hand mask and stable identity landmarks | Fewer solid body parts do not make it automatically easy. Temporal stability and recognisable acting are the hard parts; tiny avatars may lose her identity. |

No animation-time estimates are asserted here; the selected motion range, pipeline and animator determine the work.

If B, C or D is selected, likely independently moving parts are: head/neck; eyelids and gaze; brows; mouth/cheeks; high ponytail and a few hair clumps; upper arms/forearms; palms/fingers; shirt sleeves; apron body/ties/pocket; and steam curls. Parent brass cuff/earrings to their relevant parts rather than letting them drift. The welcoming hand needs a clear silhouette and natural relaxed fingers.

For E, separate the stable face/eye landmarks, welcome hand, dark ponytail suggestion, berry trace, brass glints and several translucent steam layers. Keep glow local so it does not obscure the room or replace her face with a bright blob.

## Stage2 after the choice

The requested next stage is: same-scale turnaround; eight expressions; six poses including whisk, bowl, stirring, handbell and goodbye; avatars designed for48×48 and24×24 reading; palette card; and separate transparent handbell, shimmer and whisk icons.

Those assets remain **unmade pending Nicole's direction choice**. A room style plus a simpler chat avatar is possible, provided face/ponytail/berry/brass remain consistent.

## Delivery

Stage1 composites are PNG visual direction studies. Their backgrounds and lighting are baked in. They are not production transparent character cutouts, spritesheets, layered rig files or3D models.

The gallery and contact sheet identify the directions outside the artwork. Exact prompts and selected source-image records are included. Images were made with the built-in image-generation tool.

