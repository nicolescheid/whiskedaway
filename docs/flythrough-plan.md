# The Inn fly-through: shot list and camera path

A slow, continuous walk into the Inn for the WhiskedAway YouTube video: in through the front door,
down the hallway past the clock and the dials, through the Cuddlecore door, and up to the
simmering pot. Everything in it is rendered from the real Blender scenes, the same ones the
website's panoramas come from. Nothing is generated video.

**About 40 seconds**, 1920 × 1080, 24 frames a second, rainy late afternoon (the look the site opens on).

---

## How it fits together

The hallway and the kitchen are separate Blender scenes. The walk crosses from one to the other
at the Cuddlecore door: the camera reaches the open doorway in the hallway scene, and the next
shot starts in the kitchen scene on the other side of the same door. A short dissolve hides the
join. (The kitchen's door is in its back wall, while the floorplan puts it to the kitchen's side.
Nobody can see that across a cut, so the fly-through doesn't have to wait for that fix.)

The opening and closing use the storybook picture of the Inn inside the whisk
(`art-inbox/inn-exterior/whisk-inn-master.png`), so the video begins outside the Inn and ends
back in the whisk.

## Shot list

| # | Shot | Length | What happens | Scene |
|---|---|---|---|---|
| 1 | **The Inn in the whisk** | 5 s | Slow push in on the storybook picture, toward the front door. Dissolve. | Storybook image, moved in the edit |
| 2 | **The front door opens** | 5 s | Black-brown door fills the frame. It swings open inward, lamplight spills out, and the camera steps through. | Hallway |
| 3 | **Down the hallway** | 9 s | Straight on through the entrance hall and down the runner, eye height. The clock passes on the left, the lamps glow, rain on the sea window at the end. | Hallway |
| 4 | **The magic dial** | 4 s | The camera turns left and drifts up close to the dial by the Cuddlecore door. The pointer turns from The Hall, past the star, to Cuddlecore. | Hallway |
| 5 | **The door opens** | 4.5 s | The camera eases back, the Cuddlecore door swings open onto a glimpse of the kitchen, and the camera moves into the doorway. Dissolve. | Hallway |
| 6 | **Into the kitchen** | 7 s | From the kitchen door, the camera moves slowly across the rag rug, past the armchair, toward the range. | Kitchen |
| 7 | **The pot** | 4 s | The camera rises a little onto the steaming cast-iron pot. Hold. Dissolve. | Kitchen |
| 8 | **Back to the whisk** | 3 s | The storybook picture again, pulled back to show the whole whisk. Space for the title. | Storybook image |

About 40 seconds in all. The 18 October rough cut had a glance at the stairs in the entrance hall; Nicole cut it so the walk goes straight to the kitchen.

## Camera path (metres, in each scene's own coordinates)

Hallway: X = hill side (−) to garden side (+), Y = toward the sea, eye height 1.6 m.
Kitchen: X = left/right, Y = toward the window and range, the door on the back wall at (−0.95, −2.25).

| Shot | Frames | Camera | Looking at | Lens |
|---|---|---|---|---|
| 2 | 1 to 120 | (0, −2.75, 1.55), just outside the front door, to (0, −1.6, 1.6) | straight down the hall (0, 8, 1.5) | 30 to 28 mm |
| 3 | 120 to 336 | on to (0, 0.4, 1.6), (0.1, 3.4, 1.6) and (0.15, 4.7, 1.6) | down the hall, drifting left at the end | 28 mm |
| 4 | 336 to 442 | to (−0.45, 5.15, 1.4) and hold | the dial (−0.9, 5.3, 1.3) | 35 mm |
| 5 | 442 to 552 | back to (−0.2, 5.6, 1.6), then into the doorway (−0.85, 6.0, 1.6) | the door, then straight through it | 28 mm |
| 6 | 1 to 168 (kitchen) | (−0.95, −1.9, 1.6), just inside the kitchen door, to (0.1, 0.9, 1.5) | the range | 28 mm |
| 7 | 168 to 264 (kitchen) | up to (0.15, 0.95, 1.62) | the pot and its steam (0.24, 1.91, 1.2) | 35 mm |

All moves use eased starts and stops (Bezier keyframes), no handheld shake. The camera follows a
"look at" point that moves on its own keyframes, which keeps the turns smooth.

## What moves in the scene

- **Front door** (shot 2): swings 95° inward on its hinge, over about 2 s, starting slowly.
- **The dial pointer** (shot 4): turns clockwise from The Hall (320°) through the star (0°) to
  Cuddlecore (40°), with a short pause on the star.
- **The Cuddlecore door** (shot 5): swings about 90° into the room, over about 1.5 s. Behind it, a crop of the kitchen panorama fills the far wall, so the door opens onto the kitchen before the dissolve.
- **Clock hands:** the panoramas leave the clock without hands (the website draws them), so the
  fly-through gives the grandfather clock real hands set to about 4:40, a rainy late afternoon.
- Steam, candle flames and rain stay as they are in the stills. Moving steam and flickering
  candles are a possible later pass.

## Rendering

- New `--flythrough` options for `blender/hallway_build.py` and `blender/cuddlecore_build.py`.
  They add the animated camera and the moving parts, render 1920 × 1080 frames to
  `blender/out/flythrough/`, and leave the panorama renders alone.
- **First, a quick rough version:** low resolution and low quality, to check the timing and the
  camera moves. It takes a few minutes, and I'll send it to you before the full render.
- **Then the full render:** Cycles, about 128 samples with denoising. Roughly 800 frames at
  10 to 15 seconds each on the RTX 4060, so **about 2 to 3 hours**, run in the background.
- **The edit:** ffmpeg joins the two scenes with the dissolves, adds the storybook push-ins at
  either end, and leaves space for a title and your voice-over. No music is baked in, so you can
  choose it in your own edit.

## Things for you to decide

- **Music and voice:** the fly-through is silent, ready for your voice-over and whatever music
  you choose (a public-domain recording would fit the Inn's own rule).
- **The pointer's moment on the star:** a short pause on the star hints at the magic. If you'd
  rather it went straight to Cuddlecore, that's an easy change.
- **Weather:** rain matches the site's opening, but it could just as well be the fair-weather
  version now that those renders exist.
