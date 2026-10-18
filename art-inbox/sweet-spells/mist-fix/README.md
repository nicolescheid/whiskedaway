# Sweet Spells — mist correction

Two replacement PNGs, each 2172×724:

- 16-lane-change.png: redone from14 rainy master. Matte dry/barely damp cobbles, lane-level mist receding into hills, pale even morning, streetlamp off, no rain/puddles/reflected golden streaks.
- 21-lane-night-change.png: redone from19 night-rain master because the previous night mist had the same wet-road problem. Low sea fog, matte stone, lit streetlamp with a soft halo, no rain/puddles/reflected streaks. An invented distant light was removed.

The built-in image tool made all weather/lighting changes. Technical normalization returned both to 2172×724. Night received a 2-pixel global registration, with edge extension confined to the new outer border. No structures were locally warped or pasted from rainy images.

Seven fixed-feature regions were compared against each respective master. Best full-resolution offsets were 0–1 pixel. This is a sampled registration check, not proof of mathematical pixel identity across the whole generated image. Crossfades were also visually inspected.

The correction ZIP places the two replacement images at its root. Supporting notes, prompts and previews are inside mist-fix/ so extracting it does not overwrite the full pack's notes.md or prompts.json.

Only these two target PNGs are intended for replacement. Original target files were backed up in this chat's working directory before publication. Masters and all other assets are verified separately as unchanged.

## Installation status

Write access to the C:/dev project was not granted, so its files remain unchanged. Copy the two PNGs at the ZIP root into the requested sweet-spells folder to install these corrections.
