# Gemma — chosen Direction C, Stage 2

Nicole selected **Direction C: stylised 3D Gemma**, exactly as in 03-direction-c-stylised-3d-v2.png and 08-cohost-c-stylised-3d-v2.png. These two images remain the identity masters. Earlier direction studies and the lineup are historical comparisons.

**Skin rule: soft blue cheeks in every expression and lighting condition. No rosy, peach or pink blush, and no expression-driven red tint.** Use blue-grey skin shading. Keep her lip colour as in the approved face.

## Identity and proportions

An adult kitchen genie, around 38–42, warm, intelligent and practical. Keep her facial structure, amber-brown eyes, charcoal high wavy ponytail and aged brass cuff/earrings. Her costume remains the dusty berry rolled-sleeve shirt and cream linen bib apron, with a large patch pocket and a front/side waist knot. The back has a plain waistband, without a second bow.

Start around **1.65 m apparent height from ponytail crown to steam tip**, then match the approved room image. This is a scene-placement target, not a measured human standing height. Preserve the masters’ adult head, shoulder, torso and hand relationships. Her lower body is the approved tapering blue-white steam curl, without invented legs or feet.

## Files

- 10-turnaround.png: front, side, three-quarter and back, left to right; relaxed A-pose, neutral expression, parallel-projection appearance, even light, same scale and baseline. The arms project in depth in the side view; this does not change the bind pose.
- 11-expressions.png: 4 × 2, left to right then top to bottom: welcoming hello; listening; thinking it over; delighted; gentle concern; laughing; a little oops; sleepy.
- 12-poses.png: 3 × 2: rising from the whisk; pointing; offering a steaming bowl; stirring a pot; ringing a tiny brass handbell; waving goodbye.
- 13-avatar-large.png: transparent 1024 × 1024 master for 48px display.
- 14-avatar-small.png: separately simplified transparent 1024 × 1024 master for 24px display.
- runtime/13-avatar-48.png and runtime/14-avatar-24.png: actual-size transparent PNG exports.
- 15-palette.png: six swatches, ordered skin / hair / berry on top, apron / brass / glow below.
- 16-handbell.png, 17-shimmer.png, 18-whisk.png: separate transparent 1024 × 1024 icons. The tea handbell has a turned wooden handle; the shimmer preserves partial transparency; the whisk has open transparent wire gaps.

Expression and pose names are recorded here rather than printed in the artwork.

## Palette

Use these **sRGB base-colour targets** for material authoring. Lighting and shading change rendered pixels; the raster palette card is a visual reference rather than a calibration chart.

| Part | Hex |
| --- | --- |
| Soft blue skin | #8fb8ca |
| Charcoal hair | #25232b |
| Dusty berry shirt | #8b4d5c |
| Cream linen apron | #e5d9c3 |
| Aged brass | #b07f52 |
| Golden presence glow | #e8bd72 |

Steam is pale blue-white with transparent edges. Keep gold glow local, rather than washing out the blue face.

## Blender model and rig

The turnaround is a modelling image reference, not a mesh, scan or mathematically measured blueprint. Build one coherent model and compare orthographic renders across the four views. The approved v2 room/cohost images settle facial identity, clothing and material feel. The pose sheet’s suspended pot is an action reference: give it a counter or stove support in the scene.

| Part | Separate movement and attachment |
| --- | --- |
| Root and body | Global/root placement; independent hover height and sway; torso/spine, chest, neck and head controls. Gentle breathing without separating the steam from her waist. |
| Face | Gaze, upper/lower lids and blink, inner/outer brows, jaw, lips, mouth corners and cheek deformation shapes. Support all eight expressions and speech. Cheek deformation must never drive a blush colour. |
| Arms/hands | Clavicles, upper arms, forearm twist, wrists, palms and finger/thumb joints; IK/FK for pointing, waving and cooking. Keep natural hand size and five fingers. |
| Ponytail/curls | Ponytail bone chain with damped secondary motion, a few larger curl controls and separate short face-framing strands. Attach the brass cuff firmly to the ponytail base. |
| Earrings | Parent to head/ears, with restrained secondary rotation if needed. |
| Shirt/sleeves | Separate garment mesh skinned to torso/arms; retain rolled-sleeve volume around bending elbows. |
| Apron | Separate bib/skirt mesh, with torso skinning and hem/side controls or restrained cloth simulation. Anchor straps and waistband. Tie ends and pocket can move slightly; the front/side knot stays attached. |
| Steam tail | Separate controllable curved volume/mesh/effect, stable at the waist; controls along the curl for shape, drift, turbulence and opacity. Animate independently of upper-body acting, retaining the taper and soft apron transition. |
| Glow/shimmer | Independent intensity, tint and opacity, coordinated with steam but separate from skin colour and expression controls. |
| Props | Separate whisk, bowl, spoon, pot and handbell objects with switchable hand/world constraints. Two-hand contact for the bowl; spoon grip and pot support for stirring. Bell body follows handle; clapper can swing separately. |
| Whisk emergence | Separate whisk prop with an emergence point at its wire head, driving steam attachment and character reveal. Do not shrink her head/body to create the reveal. |

For web/video use, plan lighter hair and steam exports alongside the full-quality model. This delivery contains PNG references and assets; it does not include a Blender mesh, rig or animation.

## Delivery

Artwork used the **built-in image_gen tool**. Exact prompts, including corrections for the back tie and returning cheek blush, are in stage2-prompts.json. Selected sources, dimensions, alpha checks and hashes are in stage2-manifest.json. Avatar/icon masters were normalized to 1024px, and 48px/24px avatar exports resized with alpha preserved.

stage2-gallery.html presents the pack. stage2-size-check.png shows actual-size avatars and enlarged pixel checks on light/dark backgrounds. The Stage 2 ZIP also includes both approved v2 references. The earlier Stage 1 ZIP remains an archive of the direction study.

