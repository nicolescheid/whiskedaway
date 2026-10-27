# Credits

## World map (the food map, `blender/explore/world-map.json`)

- **Natural Earth**, 1:110m Cultural Vectors, Admin 0 – Countries. Public domain (https://www.naturalearthdata.com/about/terms-of-use/). Made with Natural Earth.
- Taken through the **world-atlas** npm package (ISC licence, Mike Bostock), which repackages the Natural Earth 110m file as TopoJSON.
- Country names, regions and land borders from the **world-countries** npm package (ODbL, Mledoze), used as a list; the Inn's own labels and cuisines are in `food-map.json`.
- Redrawn by `scripts/build-world-map.mjs`: Natural Earth projection, simplified to half a unit of 1000, cut at the antimeridian. The parchment colours, inked borders, wobble and paper grain are drawn in code (`explore/food-map.js`, `food-map.css`).

Sound credits for the Inn are in `blender/explore/assets/sound/CREDITS.md`.
