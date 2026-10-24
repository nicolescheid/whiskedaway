"""
Sweet Spells: a kindly magician's den where treats that happen to be good for you are made by magic.
Builds the room, renders a 360 equirectangular panorama per barometer reading, by day or late at night,
and writes hotspot angles for the browser viewer.

Layout from art-inbox/sweet-spells/ (ChatGPT's concept pack: notes.md, layout.json) and docs/inn-floorplan.html.
Needs the Poly Haven assets:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/sweet_spells_build.py -- [--weather=rain] [--night] [--preview] [--no-render]

Axes follow layout.json and the hallway: X = hill wall (0) to the hallway wall (4.5), Y = the lane (0) to the
back wall (4.5, Cuddlecore behind it), Z = up. Metres. The bay window pushes out past y = 0 onto the lane.
The camera stands behind the spell table; the middle of the panorama looks out of the bay (-Y).

The magic is still for now (see MOVES LATER at the end of the file for what could move).
"""
import bpy
import bmesh
import json
import math
import os
import random
import sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import (ART, ASSETS, OUT, area_light, box, box_span, center_of, curtain, cyl, emission_mat,  # noqa: E402
                     image_mat, look, mat, meshes_of, model, pano_camera, pbr, point_light, retint, sphere, srgb,
                     text, use_gpu, window_glass)
import timeofday  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS
NIGHT = "--night" in ARGS
WEATHER = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--weather=")), "rain")

os.makedirs(OUT, exist_ok=True)
PACK = os.path.join(ART, "sweet-spells")
HALL = os.path.join(ART, "inn-hallway")

# One look per barometer reading, as in the kitchen. view: ChatGPT's lane; sky: world strength and tint;
# backdrop: the lane's brightness; sun: (watts/m2, colour, elevation, azimuth) through the bay, or None;
# bounce: cool fill from the bay; wet: raindrops on the glass; fill: warm room fill; exposure.
WEATHERS = {
    "rain":     dict(view="14-lane-rain.png", sky=1.1, tint=(1.0, 1.0, 1.0), backdrop=0.75, sun=None,
                     bounce=(60, (0.78, 0.86, 1.0)), wet=0.5, fill=5, lamps=0.6, exposure=0.15),
    "fair":     dict(view="15-lane-fair.png", sky=2.0, tint=(1.0, 0.97, 0.92), backdrop=1.05,
                     sun=(7.0, (1.0, 0.93, 0.8), 30, 20), bounce=(95, (1.0, 0.97, 0.92)), wet=0.0, fill=3, lamps=0.0, exposure=0.1),
    "change":   dict(view="16-lane-change.png", sky=1.5, tint=(0.95, 0.98, 1.0), backdrop=0.85, sun=None,
                     bounce=(85, (0.92, 0.95, 1.0)), wet=0.0, fill=4, lamps=0.4, exposure=0.15),
    "stormy":   dict(view="17-lane-stormy.png", sky=0.5, tint=(0.85, 0.9, 1.0), backdrop=0.5, sun=None,
                     bounce=(28, (0.7, 0.8, 1.0)), wet=0.75, fill=5, lamps=1.0, exposure=0.25),
    "very-dry": dict(view="18-lane-very-dry.png", sky=2.3, tint=(1.0, 0.92, 0.8), backdrop=1.1,
                     sun=(8.0, (1.0, 0.86, 0.66), 24, -25), bounce=(90, (1.0, 0.92, 0.82)), wet=0.0, fill=2, lamps=0.0, exposure=0.1),
}
WX = dict(WEATHERS[WEATHER])
NIGHT_VIEWS = {"rain": "19-lane-night-rain.png", "fair": "20-lane-night-fair.png", "change": "21-lane-night-change.png",
               "stormy": "22-lane-night-stormy.png", "very-dry": "23-lane-night-very-dry.png"}
if NIGHT:
    WX.update(view=NIGHT_VIEWS[WEATHER], sky=0.04, tint=(0.55, 0.62, 1.0), backdrop=0.8, sun=None,
              bounce=(4, (0.55, 0.62, 1.0)), fill=1.0, lamps=0.8, exposure=-0.1)
# Dawn and dusk: --dawn / --dusk (timeofday.py). The bay looks onto the village lane (east): the sun reaches it at dawn.
TIME = "dawn" if "--dawn" in ARGS else "dusk" if "--dusk" in ARGS else None
if TIME:
    WX.update(timeofday.look(TIME, WX, "dawn", 20, "lamps"))
    WX.update(view=timeofday.plate(os.path.join(PACK, WEATHERS[WEATHER]["view"]), os.path.join(PACK, NIGHT_VIEWS[WEATHER]),
                                   TIME, f"lane_{WEATHER}"))
GLOW = 1.4 if NIGHT else 1.0          # candles, fire and lamps are lit whatever the weather; a touch brighter at night

W, D, H = 4.5, 4.5, 2.7               # inside the room
EYE = 1.6
CAM = (2.25, 2.75, EYE)               # behind the spell table
CAM_YAW = 180                         # the middle of the panorama looks out of the bay (-Y)
# The bay: opening in the front wall from BAY_A to BAY_D, canted sides, front face 0.65 m out on the lane
BAY = [(0.95, 0.0), (1.6, -0.65), (2.9, -0.65), (3.55, 0.0)]
SILL, HEAD, BAY_TOP = 0.52, 2.12, 2.3
SEAT = 0.45
DOOR_Y, DOOR_W, DOOR_H = 3.4, 0.9, 2.1      # hallway door (hall side: the hallway's y = 2.0)
DIAL_AT = (W, 2.62, 1.3)                    # room dial, lane side of the door, as in the hallway
TABLE = (2.1, 1.85)                         # spell table centre; 1.7 x 0.85, top at 0.9
TABLE_TOP = 0.9
BOWL = (2.08, 1.8)

HOTSPOTS = {}


def hotspot(key, label, target, kind="interactive", overlay=None):
    if isinstance(target, (list, tuple)) and target and hasattr(target[0], "name"):
        objs = list(target)
    elif hasattr(target, "name"):
        objs = meshes_of(target) or [target]
    else:
        objs = []
    HOTSPOTS[key] = {"label": label, "type": kind, "overlay": overlay, "center": [round(v, 3) for v in center_of(target)],
                     "objects": [o.name for o in objs]}


def frame_matrix(origin, normal, right):
    """4x4 matrix whose local X = right, Y = up, Z = normal (pointing out of the wall)."""
    n, r = Vector(normal).normalized(), Vector(right).normalized()
    up = n.cross(r)
    m = Matrix((r, up, n)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


def group(name, matrix, parts):
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.matrix_world = matrix
    bpy.context.view_layer.update()
    return root


# ---------------------------------------------------------------- mesh helpers

def mesh_obj(name, verts, faces, material, smooth=True, recalc=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = smooth
    if material:
        o.data.materials.append(material)
    return o


def lathe(name, prof, material, loc, segs=48, wobble=None, shell=0.0):
    """A turned shape: prof is [(radius, z), ...] from the bottom up. wobble(angle) scales the radius (fluting).
    shell > 0 gives an open surface that thickness (glass domes, bowls)."""
    verts, faces = [], []
    for r, z in prof:
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = max(r, 0.0004) * (wobble(a) if wobble else 1.0)
            verts.append((loc[0] + rr * math.cos(a), loc[1] + rr * math.sin(a), loc[2] + z))
    for k in range(len(prof) - 1):
        for i in range(segs):
            a, b = k * segs + i, k * segs + (i + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    o = mesh_obj(name, verts, faces, material, recalc=False)
    if shell:
        o.modifiers.new("shell", "SOLIDIFY").thickness = shell
    return o


def prism(name, pts, z0, z1, material, bevel=0.0):
    """A straight extrusion of a plan polygon (pts counter-clockwise or not: normals are recalculated)."""
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    o = mesh_obj(name, verts, faces, material, smooth=False)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width, mod.segments = bevel, 3
    return o


def seg_box(name, p, q, t0, t1, o0, o1, z0, z1, material, bevel=0.0):
    """A box along the plan segment p->q, from fraction t0 to t1 of it, o0..o1 metres out along its outward
    normal (the right-hand side of p->q), z0..z1 high."""
    d = Vector((q[0] - p[0], q[1] - p[1], 0))
    ln = d.length
    u = d / ln
    nrm = Vector((u.y, -u.x, 0))
    c = Vector((p[0], p[1], 0)) + u * ln * (t0 + t1) / 2 + nrm * (o0 + o1) / 2
    b = box(name, (c.x, c.y, (z0 + z1) / 2), (ln * (t1 - t0), o1 - o0, z1 - z0), material, bevel=bevel)
    b.rotation_euler = (0, 0, math.atan2(u.y, u.x))
    return b


def tube(name, pts, r, material, radii=None, caps=True, res=4):
    """A smooth tube through pts (NURBS), radius r scaled per point by radii."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = caps
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for k, (pt, p) in enumerate(zip(sp.points, pts)):
        pt.co = (p[0], p[1], p[2], 1.0)
        pt.radius = radii[k] if radii else 1.0
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def berry(name, loc, r, material, seed=0, kind="rasp"):
    """A raspberry or blackberry: a core with drupelets on it (one mesh)."""
    bm = bmesh.new()
    rnd = random.Random(seed)
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r * 0.8,
                               matrix=Matrix.Diagonal((1, 1, 1.15, 1)))
    n = 46 if kind == "rasp" else 30
    for k in range(n):
        zf = 1 - 2 * (k + 0.5) / n
        if kind == "rasp" and zf > 0.82:              # the hollow where the stalk was
            continue
        ang = k * 2.39996
        rad = math.sqrt(1 - zf * zf)
        p = Vector((r * rad * math.cos(ang), r * rad * math.sin(ang), r * 1.12 * zf)) * rnd.uniform(0.97, 1.03)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * (0.3 if kind == "rasp" else 0.36), matrix=Matrix.Translation(p))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    o.location = loc
    o.rotation_euler = (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6.28))
    o.data.materials.append(material)
    return o


# ---------------------------------------------------------------- materials

def marble(name):
    """Cream marble with soft grey and honey veins (procedural: a heavily distorted wave)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0.3, 0.2, 0.7)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 2.6
    wave.inputs["Distortion"].default_value = 14
    wave.inputs["Detail"].default_value = 8
    wave.inputs["Detail Scale"].default_value = 1.5
    nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, srgb("#a89f92")
    el[1].position, el[1].color = 0.06, srgb("#efe7da")
    mid = el.new(0.025)
    mid.color = srgb("#d6c8ae")
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.3
    p.inputs["Coat Weight"].default_value = 0.25
    return m


def stone(name):
    """Pale rubble stone for the hearth: Voronoi blocks, lime mortar between them, a little soot low down."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (2.2, 2.2, 3.6)          # blocks longer than tall
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    nt.links.new(mp.outputs["Vector"], vor.inputs["Vector"])
    vcol = nt.nodes.new("ShaderNodeTexVoronoi")                 # one colour per stone
    nt.links.new(mp.outputs["Vector"], vcol.inputs["Vector"])
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    nt.links.new(vcol.outputs["Color"], bw.inputs["Color"])
    tone = nt.nodes.new("ShaderNodeValToRGB")
    tone.color_ramp.elements[0].color = srgb("#a8987e")
    tone.color_ramp.elements[1].color = srgb("#d8ccb6")
    nt.links.new(bw.outputs["Val"], tone.inputs["Fac"])
    grit = nt.nodes.new("ShaderNodeTexNoise")
    grit.inputs["Scale"].default_value = 60
    grit.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], grit.inputs["Vector"])
    gmix = nt.nodes.new("ShaderNodeMix")
    gmix.data_type, gmix.blend_type = "RGBA", "OVERLAY"
    gmix.inputs["Factor"].default_value = 0.35
    nt.links.new(tone.outputs["Color"], gmix.inputs[6])
    nt.links.new(grit.outputs["Color"], gmix.inputs[7])
    joint = nt.nodes.new("ShaderNodeMapRange")                  # 1 on the stone, 0 in the joint
    joint.inputs["From Min"].default_value = 0.015
    joint.inputs["From Max"].default_value = 0.045
    nt.links.new(vor.outputs["Distance"], joint.inputs["Value"])
    mortar = nt.nodes.new("ShaderNodeMix")
    mortar.data_type = "RGBA"
    mortar.inputs[6].default_value = srgb("#cbbfa8")
    nt.links.new(joint.outputs["Result"], mortar.inputs["Factor"])
    nt.links.new(gmix.outputs[2], mortar.inputs[7])
    nt.links.new(mortar.outputs[2], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    hsum = nt.nodes.new("ShaderNodeMath")
    hsum.operation = "ADD"
    nt.links.new(joint.outputs["Result"], hsum.inputs[0])
    nt.links.new(grit.outputs["Fac"], hsum.inputs[1])
    nt.links.new(hsum.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    p.inputs["Roughness"].default_value = 0.9
    return m


def velvet(name, hex_color, image=None, tile=0.6):
    m = image_mat(name, image, rough=0.85, tile=tile) if image else mat(name, srgb(hex_color), rough=0.85)
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Sheen Weight"].default_value = 0.8
    p.inputs["Sheen Tint"].default_value = srgb("#e9a3b6")
    p.inputs["Sheen Roughness"].default_value = 0.4
    return m


def glow_liquid(name, hex_color, strength):
    m = mat(name, srgb(hex_color), rough=0.15, transmission=0.85, ior=1.4, emission=srgb(hex_color), strength=strength)
    return m


def volume_mat(name, hex_color, density, scale=1.0):
    """Soft see-through vapour that fades out toward the edge of its mesh."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = srgb(hex_color)
    vol.inputs["Emission Color"].default_value = srgb(hex_color)
    vol.inputs["Emission Strength"].default_value = 0.15
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 9 * scale
    nz.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = 0.42
    rng.inputs["From Max"].default_value = 0.75
    rng.inputs["To Max"].default_value = density
    nt.links.new(nz.outputs["Fac"], rng.inputs["Value"])
    nt.links.new(rng.outputs["Result"], vol.inputs["Density"])
    nt.links.new(vol.outputs["Volume"], nt.nodes["Material Output"].inputs["Volume"])
    return m


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rnd = random.Random(9)

    # Materials: the Inn's scans (kitchen and hallway), recoloured to ChatGPT's Sweet Spells notes
    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#ede3cf"), tint_mix=0.85, bump=0.6)
    floor_m = pbr("floor", "old_wooden_floor_01", 2.5, tint=srgb("#5e3f28"), tint_mix=0.3, rough_add=0.15, bump=0.8)
    beam_wood = pbr("beams", "wood_table_worn", 1.5, tint=srgb("#6e4a2b"), tint_mix=0.45, rot_z=90)
    oak = pbr("oak", "wood_table_worn", 1.0, tint=srgb("#9b693e"), tint_mix=0.35, rot_z=90)
    dark_oak = pbr("dark_oak", "wood_table_worn", 1.0, tint=srgb("#644024"), tint_mix=0.45, rot_z=90)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#9b693e"), tint_mix=0.55)
    door_dark = pbr("door_dark", "medieval_wood", 2.0, tint=srgb("#6e4a2b"), tint_mix=0.6)
    log_wood = pbr("logs", "medieval_wood", 0.6, tint=srgb("#3a2a1c"), tint_mix=0.6, bump=1.2)
    linen = pbr("rose_linen", "rough_linen", 0.4, tint=srgb("#c27a8c"), tint_mix=1.0, bump=0.5)
    paint = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    brass = mat("brass", srgb("#b07f52"), rough=0.4, metal=1.0)
    brass_worn = mat("brass_worn", srgb("#bd9655"), rough=0.3, metal=1.0)
    gold = mat("gold", srgb("#c2a05a"), rough=0.3, metal=1.0)
    copper = mat("copper", srgb("#b46a43"), rough=0.35, metal=1.0)
    iron = mat("iron", srgb("#25221f"), rough=0.7, metal=0.7)
    ink = mat("engraving", srgb("#3a2a18"), rough=0.5, metal=0.6)
    glass = mat("glass", (0.97, 0.98, 0.98, 1), rough=0.02, transmission=1.0, ior=1.5)
    paper = mat("paper", srgb("#eadfc7"), rough=0.9)
    ceramic = mat("ceramic", srgb("#e8ddc8"), rough=0.35, coat=0.3)
    beeswax = mat("beeswax", srgb("#e2c78a"), rough=0.55)
    beeswax.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.5
    flame = mat("flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.55, 0.2, 1), strength=30)
    chocolate = mat("chocolate", srgb("#301d15"), rough=0.15, coat=0.6)
    cocoa = mat("cocoa_dust", srgb("#3b2419"), rough=0.95)
    rasp = mat("raspberry", srgb("#b3263f"), rough=0.35)
    rasp.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.4
    blackb = mat("blackberry", srgb("#1e1424"), rough=0.2, coat=0.5)
    bluebe = mat("blueberry", srgb("#2c3550"), rough=0.5)
    cream = mat("cream", srgb("#f6f0e2"), rough=0.6)
    cream.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.3
    crust = mat("pastry", srgb("#c58a4c"), rough=0.75)
    meringue = mat("meringue", srgb("#f3e8d4"), rough=0.7)
    meringue.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.25
    granola = mat("granola", srgb("#a8783e"), rough=0.9)
    compote = mat("compote", srgb("#7e1f35"), rough=0.2, coat=0.5)
    sparkle = mat("sparkle", srgb("#e8c46a"), emission=srgb("#ffd88a"), strength=14)
    plum_velvet = velvet("plum_velvet", "#492438")
    damask = velvet("damask", None, os.path.join(PACK, "11-plum-damask-tile.png"), tile=0.55)
    rose_velvet = velvet("rose_velvet", "#a8566c")
    marble_m = marble("marble")
    stone_m = stone("stone")
    leather = [mat(f"leather_{i}", srgb(c), rough=0.65) for i, c in enumerate(
        ["#543529", "#523343", "#6e2a2f", "#2f3e33", "#8a6a48", "#2c3447", "#4a2a30", "#6b4a32"])]

    # ---- Shell: floor, ceiling, walls, beams, skirting
    box_span("floor", -0.2, W + 0.2, -1.0, D + 0.2, -0.1, 0, floor_m)
    box_span("ceiling", -0.2, W + 0.2, 0.0, D + 0.2, H, H + 0.1, plaster)
    box_span("wall_hill", -0.15, 0, -0.3, D + 0.15, 0, H, plaster)
    box_span("wall_back", -0.15, W + 0.15, D, D + 0.15, 0, H, plaster)
    d0, d1 = DOOR_Y - DOOR_W / 2, DOOR_Y + DOOR_W / 2
    box_span("wall_hall_a", W, W + 0.15, -0.3, d0, 0, H, plaster)
    box_span("wall_hall_b", W, W + 0.15, d1, D + 0.15, 0, H, plaster)
    box_span("wall_hall_over", W, W + 0.15, d0, d1, DOOR_H, H, plaster)
    box_span("door_beyond", W + 0.15, W + 0.3, d0, d1, 0, DOOR_H, mat("hall_dark", srgb("#2a2018"), 0.9))
    ax, dx = BAY[0][0], BAY[3][0]
    box_span("wall_front_l", -0.15, ax, -0.3, 0, 0, H, plaster)
    box_span("wall_front_r", dx, W + 0.15, -0.3, 0, 0, H, plaster)
    box_span("wall_front_over", ax, dx, -0.3, 0, BAY_TOP, H, plaster)
    for i, y in enumerate((0.7, 2.25, 3.8)):
        box_span(f"beam_{i}", 0, W, y - 0.1, y + 0.1, H - 0.2, H, beam_wood, bevel=0.015)
    for name, x0, x1, y0, y1 in (("skirt_hill", 0, 0.02, 0, D), ("skirt_back", 0, W, D - 0.02, D),
                                 ("skirt_hall_a", W - 0.02, W, 0, d0 - 0.08), ("skirt_hall_b", W - 0.02, W, d1 + 0.08, D),
                                 ("skirt_front_l", 0, ax, 0, 0.02), ("skirt_front_r", dx, W, 0, 0.02)):
        box_span(name, x0, x1, y0, y1, 0, 0.16, paint, bevel=0.003)

    # ---- The bay window: three faces of cream casements on a panelled base, a window seat inside
    window = window_glass("bay_glass", wet=WX["wet"])
    panes = []
    for fi, (p, q) in enumerate(zip(BAY[:-1], BAY[1:])):
        lights = 3 if fi == 1 else 2
        seg_box(f"bay_base_{fi}", p, q, -0.06, 1.06, 0.0, 0.18, 0, SILL, plaster)
        seg_box(f"bay_sill_{fi}", p, q, -0.04, 1.04, -0.08, 0.1, SILL - 0.04, SILL, oak, bevel=0.006)
        seg_box(f"bay_over_{fi}", p, q, -0.06, 1.06, 0.0, 0.18, HEAD, BAY_TOP + 0.1, plaster)
        seg_box(f"bay_head_{fi}", p, q, 0.0, 1.0, 0.04, 0.12, HEAD - 0.06, HEAD, paint)
        seg_box(f"bay_bottom_{fi}", p, q, 0.0, 1.0, 0.04, 0.12, SILL, SILL + 0.06, paint)
        seg_box(f"bay_transom_{fi}", p, q, 0.0, 1.0, 0.05, 0.11, 1.68, 1.73, paint)
        for k in range(lights + 1):
            t = k / lights
            w = 0.06 if k in (0, lights) else 0.045
            ln = math.dist(p, q)
            seg_box(f"bay_post_{fi}_{k}", p, q, t - w / 2 / ln, t + w / 2 / ln, 0.04, 0.12, SILL, HEAD, paint)
        for k in range(lights):                               # glazing bars: two little panes up, four down
            for z in (SILL + (1.68 - SILL) / 2, 1.73 + (HEAD - 1.73) / 2):
                seg_box(f"bay_bar_{fi}_{k}_{z:.2f}", p, q, k / lights, (k + 1) / lights, 0.07, 0.1, z - 0.012, z + 0.012, paint)
        g = seg_box(f"bay_pane_{fi}", p, q, 0.0, 1.0, 0.085, 0.091, SILL, HEAD, window)
        g.visible_shadow = False
        panes.append(g)
    prism("bay_roof", [(ax, 0.0), (1.6, -0.83), (2.9, -0.83), (dx, 0.0)], BAY_TOP, BAY_TOP + 0.12, plaster)
    # the seat fills the bay, panelled front facing the room, rose velvet cushion
    seat_pts = [(ax + 0.02, 0.12), (ax + 0.02, 0.0), (1.64, -0.58), (2.86, -0.58), (dx - 0.02, 0.0), (dx - 0.02, 0.12)]
    prism("seat_base", seat_pts, 0, SEAT - 0.06, paint)
    for i, x in enumerate((1.15, 1.8, 2.45, 3.1)):
        box(f"seat_panel_{i}", (x + 0.12, 0.125, 0.2), (0.5, 0.012, 0.26), paint, bevel=0.01)
    cushion = prism("seat_cushion", [(ax + 0.04, 0.1), (ax + 0.04, 0.0), (1.65, -0.56), (2.85, -0.56), (dx - 0.04, 0.0), (dx - 0.04, 0.1)],
                    SEAT - 0.06, SEAT + 0.04, rose_velvet, bevel=0.03)
    for i, (x, y, r, col) in enumerate(((1.45, -0.32, 35, "#492438"), (1.85, -0.45, 8, "#c27a8c"), (2.95, -0.42, -12, "#6a3049"),
                                        (3.3, -0.2, -40, "#c27a8c"))):
        pil = model("throw_pillows_01", (x, y, SEAT + 0.02), rot_z=180 + r, scale=0.42)
        retint(pil, col, lo=0.6, hi=1.15)
    hotspot("window-seat", "The window seat", [cushion], kind="ambient")

    # Curtains: deep plum velvet either side of the bay, on a brass rod
    cyl("curtain_rod", (W / 2, 0.1, BAY_TOP + 0.08), 0.014, dx - ax + 1.0, brass, rot=(0, math.radians(90), 0))
    for x in (ax - 0.5, dx + 0.5):
        sphere(f"rod_finial_{x}", (x, 0.1, BAY_TOP + 0.08), 0.03, brass)
    curtain("curtain_r", ax - 0.22, 0.1, BAY_TOP + 0.06, 0.5, BAY_TOP + 0.04, plum_velvet, pleats=7, amp=0.04, seed=5)
    curtain("curtain_l", dx + 0.22, 0.1, BAY_TOP + 0.06, 0.5, BAY_TOP + 0.04, plum_velvet, pleats=7, amp=0.04, seed=6)

    # The lane outside: ChatGPT's view on one emissive plate. Its world position is shared with the
    # Chiapothecary's shop window (docs: the Inn's middle, hallway x = 0, is room x = 5.55), so both
    # windows look at the same stretch of lane from their own places.
    bd_w, bd_h, bd_y, bd_x = 24.0, 8.0, -7.5, 5.55
    bd_top = EYE + 0.58 * bd_h                               # eye height sits 58% down the image
    bpy.ops.mesh.primitive_plane_add(size=1, location=(bd_x, bd_y, bd_top - bd_h / 2),
                                     rotation=(math.radians(90), 0, math.radians(180)))   # faces the room, not mirrored
    bd = bpy.context.active_object
    bd.name = "lane_view"
    bd.scale = (bd_w, bd_h, 1)
    bpy.ops.object.transform_apply(scale=True)
    bd.visible_shadow = False
    bd.data.materials.append(emission_mat("lane_view", os.path.join(PACK, WX["view"]), WX["backdrop"]))
    hotspot("lane-window", "The lane", panes[1], kind="ambient")

    # ---- The spell table: heavy oak base, drawers, marble slab
    tx, ty = TABLE
    tw, td = 1.7, 0.85
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"table_leg_{sx}{sy}", (tx + sx * (tw / 2 - 0.08), ty + sy * (td / 2 - 0.08), 0.42), (0.09, 0.09, 0.84), oak, bevel=0.012)
    box("table_apron", (tx, ty, 0.76), (tw - 0.08, td - 0.08, 0.16), oak, bevel=0.01)
    box("table_shelf", (tx, ty, 0.14), (tw - 0.1, td - 0.1, 0.035), oak, bevel=0.006)
    for i, x in enumerate((tx - 0.4, tx + 0.4)):
        box(f"table_drawer_{i}", (x, ty + td / 2 - 0.035, 0.76), (0.6, 0.02, 0.12), oak, bevel=0.008)
        sphere(f"table_knob_{i}", (x, ty + td / 2 - 0.015, 0.76), 0.018, brass)
        box(f"table_drawer_b_{i}", (x, ty - td / 2 + 0.035, 0.76), (0.6, 0.02, 0.12), oak, bevel=0.008)
        sphere(f"table_knob_b_{i}", (x, ty - td / 2 + 0.015, 0.76), 0.018, brass)
    slab = box("table_marble", (tx, ty, TABLE_TOP - 0.02), (tw, td, 0.04), marble_m, bevel=0.008)
    for i, x in enumerate((tx - 0.55, tx + 0.5)):                       # baskets and copper pans on the shelf
        model("wicker_basket_01", (x, ty, 0.16), rot_z=10 + 90 * i, scale=1.0)
    lathe("shelf_pan", [(0.0, 0), (0.09, 0), (0.1, 0.06), (0.1, 0.07)], copper, (tx + 0.05, ty + 0.1, 0.16), shell=0.003)

    # The spell: a speckled bowl of chocolate, a whisk turning on its own above it, raspberries and a ribbon
    # of chocolate hanging in the air, a few gold sparks. Still for now.
    bx, by = BOWL
    bowl = lathe("spell_bowl", [(0.0, 0.0), (0.07, 0.0), (0.075, 0.008), (0.12, 0.03), (0.155, 0.075), (0.17, 0.125), (0.172, 0.13)],
                 ceramic, (bx, by, TABLE_TOP), segs=64, shell=0.008)
    choc_top = lathe("spell_chocolate", [(0.0, 0.0), (0.15, 0.0), (0.152, 0.004)], chocolate, (bx, by, TABLE_TOP + 0.098))
    wire = mat("whisk_steel", srgb("#c9c6bf"), rough=0.25, metal=1.0)
    w_tip = Vector((bx + 0.01, by - 0.01, TABLE_TOP + 0.11))        # the wires dip into the chocolate
    w_axis = Vector((0.22, 0.14, 1.0)).normalized()
    L, R = 0.26, 0.058
    side = w_axis.cross(Vector((0, 0, 1))).normalized()
    up2 = w_axis.cross(side)
    whisk = []
    for k in range(4):                                              # four loops, eight wires
        a = math.pi * k / 4
        rad = side * math.cos(a) + up2 * math.sin(a)
        pts = []
        for j in range(25):
            th = 2 * math.pi * j / 24
            ax_ = L * (1 + math.cos(th)) / 2                       # 0 at the tip, L at the handle
            r_ = R * math.sin(th) * (1.15 - 0.5 * ax_ / L)
            pts.append(w_tip + w_axis * ax_ + rad * r_)
        whisk.append(tube(f"whisk_wire_{k}", pts, 0.0016, wire, caps=False, res=2))
    hb = w_tip + w_axis * L
    hlen = 0.13
    hc = hb + w_axis * (hlen / 2 + 0.01)
    rot = w_axis.to_track_quat("Z", "Y").to_euler()
    whisk.append(cyl("whisk_ferrule", tuple(hb + w_axis * 0.008), 0.009, 0.03, wire, rot=rot))
    whisk.append(cyl("whisk_handle", tuple(hc), 0.013, hlen, door_oak, rot=rot, bevel=0.005))
    # the ribbon of chocolate: falls from the air in a lazy curl around the whisk into the bowl
    ribbon_pts, radii = [], []
    for j in range(14):
        t = j / 13
        ang = 2.4 * math.pi * t + 0.8
        rr = 0.07 * (1 - t) + 0.025
        ribbon_pts.append((bx + 0.04 + rr * math.cos(ang), by - 0.02 + rr * math.sin(ang), TABLE_TOP + 0.5 - 0.39 * t))
        radii.append(0.55 + 0.6 * t)
    ribbon = tube("chocolate_ribbon", ribbon_pts, 0.012, chocolate, radii=radii)
    ribbon.data.bevel_mode = "ROUND"
    drop = sphere("chocolate_drop", (bx + 0.12, by - 0.06, TABLE_TOP + 0.3), 0.006, chocolate, scale=(1, 1, 1.4))
    berries = []
    for k, (dxy, dz) in enumerate((((-0.1, -0.06), 0.33), ((0.1, 0.05), 0.42), ((-0.04, 0.09), 0.27), ((0.15, -0.08), 0.24),
                                   ((-0.13, 0.03), 0.47))):
        berries.append(berry(f"floating_raspberry_{k}", (bx + dxy[0], by + dxy[1], TABLE_TOP + dz), 0.011, rasp, seed=k))
    srnd = random.Random(3)
    for k in range(34):                                             # sparse gold sparks in the air over the bowl
        ang, rr = srnd.uniform(0, 6.28), srnd.uniform(0.03, 0.22)
        s = sphere(f"spark_{k}", (bx + rr * math.cos(ang), by + rr * math.sin(ang), TABLE_TOP + srnd.uniform(0.15, 0.6)),
                   srnd.uniform(0.0012, 0.0032), sparkle)
        s.visible_shadow = False
    point_light("spell_glow", (bx, by, TABLE_TOP + 0.35), 2.5 * GLOW, (1.0, 0.8, 0.45), radius=0.15)
    hotspot("spell-table", "Cast a spell", [bowl, ribbon] + whisk, kind="submit")

    # Dressing on the table: raspberries, chocolate on a board, a jug, eggs, the rose cloth, a tall candle
    rb = lathe("berry_bowl", [(0.0, 0.0), (0.05, 0.0), (0.075, 0.03), (0.085, 0.05)], ceramic, (tx + 0.42, ty + 0.12, TABLE_TOP), shell=0.005)
    for k in range(9):
        a, r_ = k * 2.4, 0.02 + 0.03 * ((k * 7) % 3) / 2
        berry(f"bowl_raspberry_{k}", (tx + 0.42 + r_ * math.cos(a), ty + 0.12 + r_ * math.sin(a), TABLE_TOP + 0.045 + 0.01 * (k % 2)), 0.011, rasp, seed=20 + k)
    for k in range(4):
        berry(f"table_raspberry_{k}", (tx - 0.25 + 0.07 * k, ty + 0.3 - 0.02 * k, TABLE_TOP + 0.011), 0.011, rasp, seed=40 + k)
    board = model("wooden_cutting_board", (tx - 0.45, ty + 0.15, TABLE_TOP), rot_z=80)
    for k in range(6):
        box(f"choc_piece_{k}", (tx - 0.5 + 0.035 * (k % 3), ty + 0.12 + 0.05 * (k // 3), TABLE_TOP + 0.03), (0.03, 0.04, 0.008), chocolate, bevel=0.002)
    model("jug_01", (tx + 0.62, ty - 0.2, TABLE_TOP), rot_z=200, scale=0.8)
    eggb = lathe("egg_bowl", [(0.0, 0.0), (0.05, 0.0), (0.08, 0.035), (0.09, 0.055)], ceramic, (tx - 0.65, ty - 0.2, TABLE_TOP), shell=0.005)
    for k in range(3):
        sphere(f"egg_{k}", (tx - 0.65 + 0.035 * math.cos(k * 2.1), ty - 0.2 + 0.035 * math.sin(k * 2.1), TABLE_TOP + 0.05), 0.025,
               mat(f"egg_{k}", srgb("#d9a77a"), rough=0.5), scale=(1, 1, 1.3))
    cloth = box("rose_cloth", (tx + 0.3, ty + 0.28, TABLE_TOP + 0.006), (0.26, 0.16, 0.012), linen, bevel=0.005)
    cloth.rotation_euler = (0, 0, math.radians(14))

    candles = []

    def candle(name, loc, h=0.16, r=0.022, holder=True):
        x, y, z = loc
        if holder:
            lathe(f"{name}_holder", [(0.0, 0.0), (0.05, 0.0), (0.05, 0.008), (0.018, 0.02), (0.012, 0.07), (0.03, 0.085), (0.03, 0.095)],
                  brass, (x, y, z))
            z += 0.095
        cyl(f"{name}_wax", (x, y, z + h / 2), r, h, beeswax, bevel=0.004)
        cyl(f"{name}_wick", (x, y, z + h + 0.005), 0.0015, 0.01, iron, verts=8, bevel=0)
        f = sphere(f"{name}_flame", (x, y, z + h + 0.019), 0.0085, flame, scale=(1, 1, 2.3))
        f.visible_shadow = False
        candles.append(point_light(f"{name}_light", (x, y, z + h + 0.03), 3.5 * GLOW, (1.0, 0.52, 0.2), radius=0.012))
        return f

    candle("table_candle", (tx + 0.72, ty + 0.25, TABLE_TOP), h=0.2, r=0.028)

    # ---- The music box on its cake stand, on a little round marble-topped table by the bay
    cx_, cy_ = 3.15, 0.62
    lathe("cake_table_foot", [(0.0, 0.0), (0.22, 0.0), (0.22, 0.03), (0.06, 0.08), (0.035, 0.2), (0.035, 0.62), (0.07, 0.68), (0.07, 0.7)],
          oak, (cx_, cy_, 0))
    cyl("cake_table_top", (cx_, cy_, 0.715), 0.3, 0.03, marble_m, verts=64, bevel=0.006)
    stand = [lathe("stand_foot", [(0.0, 0.0), (0.09, 0.0), (0.09, 0.012), (0.02, 0.04), (0.012, 0.45)], brass, (cx_, cy_, 0.73))]
    tiers = [(0.2, 0.83), (0.15, 0.98), (0.11, 1.12)]
    for i, (r, z) in enumerate(tiers):
        stand.append(cyl(f"stand_plate_{i}", (cx_, cy_, z), r, 0.008, brass, verts=64, bevel=0.002))
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.005, location=(cx_, cy_, z + 0.005))
        bpy.context.active_object.data.materials.append(gold)
    stand.append(cyl("stand_rod", (cx_, cy_, 1.0), 0.008, 0.28, brass))
    trnd = random.Random(12)
    for i, (r, z) in enumerate(tiers[:2]):                          # little treats on the lower tiers
        n = 7 if i == 0 else 5
        for k in range(n):
            a = 2 * math.pi * k / n + i * 0.3
            px, py = cx_ + (r - 0.055) * math.cos(a), cy_ + (r - 0.055) * math.sin(a)
            kind = (k + i) % 3
            if kind == 0:                                           # a tiny berry tart
                lathe(f"mini_tart_{i}_{k}", [(0.0, 0.0), (0.028, 0.0), (0.033, 0.016), (0.03, 0.018), (0.0, 0.016)],
                      crust, (px, py, z + 0.004), wobble=lambda t: 1 + 0.06 * math.cos(14 * t))
                berry(f"mini_tart_berry_{i}_{k}", (px, py, z + 0.028), 0.01, rasp, seed=60 + k)
            elif kind == 1:                                         # a cocoa-dusted truffle
                sphere(f"mini_truffle_{i}_{k}", (px, py, z + 0.02), 0.017, cocoa)
            else:                                                   # a little cream puff with a blueberry
                sphere(f"mini_puff_{i}_{k}", (px, py, z + 0.02), 0.022, crust, scale=(1, 1, 0.75))
                sphere(f"mini_puff_cream_{i}_{k}", (px, py, z + 0.036), 0.012, cream)
                sphere(f"mini_puff_berry_{i}_{k}", (px, py, z + 0.048), 0.007, bluebe)
    # the music box: carved oak, rose inlay in gold, plum velvet inside, lid open, a dancer on her spindle
    mb_z = tiers[2][1] + 0.008
    mbw, mbd, mbh = 0.18, 0.12, 0.075
    mb_oak = pbr("music_box_oak", "wood_table_worn", 0.3, tint=srgb("#6b4024"), tint_mix=0.5)
    parts = []
    for fx in (-1, 1):
        for fy in (-1, 1):
            parts.append(sphere(f"mb_foot_{fx}{fy}", (fx * (mbw / 2 - 0.012), fy * (mbd / 2 - 0.012), 0.006), 0.008, gold))
    parts.append(box("mb_body", (0, 0, 0.012 + mbh / 2), (mbw, mbd, mbh), mb_oak, bevel=0.004))
    parts.append(box("mb_velvet", (0, 0, 0.012 + mbh - 0.004), (mbw - 0.016, mbd - 0.016, 0.004), plum_velvet, bevel=0))
    for nm, sz, at in (("front", (0.13, 0.002, 0.045), (0, -mbd / 2 - 0.001, 0.012 + mbh / 2)),
                       ("side", (0.002, 0.08, 0.045), (mbw / 2 + 0.001, 0, 0.012 + mbh / 2))):
        parts.append(box(f"mb_inlay_{nm}", at, sz, mat(f"mb_rose_{nm}", srgb("#c27a8c"), rough=0.4), bevel=0))
        rim = tuple(v + 0.006 if v > 0.01 else 0.0012 for v in sz)     # thinner than the inlay: a gold border round it
        parts.append(box(f"mb_inlay_rim_{nm}", at, rim, gold, bevel=0))
    for z in (0.012, 0.012 + mbh):
        parts.append(box(f"mb_band_{z}", (0, 0, z), (mbw + 0.003, mbd + 0.003, 0.004), gold, bevel=0.001))
    parts.append(sphere("mb_clasp", (0, -mbd / 2 - 0.004, 0.012 + mbh - 0.01), 0.006, gold))
    parts.append(cyl("mb_key_stem", (mbw / 2 + 0.012, 0, 0.012 + mbh / 2), 0.0025, 0.024, gold, rot=(0, math.radians(90), 0)))
    parts.append(box("mb_key_bow", (mbw / 2 + 0.026, 0, 0.012 + mbh / 2), (0.004, 0.026, 0.018), gold, bevel=0.003))
    # lid hinged along the back edge, opened about 100 degrees
    # built closed with its back edge on the hinge line (local y = 0), then swung up about it
    lid = [box("mb_lid", (0, -mbd / 2, 0.011), (mbw, mbd, 0.02), mb_oak, bevel=0.004),
           box("mb_lid_velvet", (0, -mbd / 2, -0.0005), (mbw - 0.02, mbd - 0.02, 0.002), plum_velvet, bevel=0),
           box("mb_lid_mirror", (0, -mbd / 2, -0.0015), (0.08, 0.06, 0.001), mat("mirror", srgb("#d8d4cc"), rough=0.05, metal=1.0), bevel=0),
           box("mb_lid_inlay", (0, -mbd / 2, 0.0215), (0.12, 0.08, 0.001), mat("mb_rose_lid", srgb("#c27a8c"), rough=0.4), bevel=0)]
    hinge = Matrix.Translation((0, mbd / 2, 0.012 + mbh)) @ Matrix.Rotation(math.radians(-100), 4, "X")
    parts.append(group("mb_lid_set", hinge, lid))
    # the dancer, about 8 cm, a carved ornament in cream and rose
    dz = 0.012 + mbh
    dancer_m = mat("dancer", srgb("#f1e6dc"), rough=0.4)
    tutu = mat("tutu", srgb("#e7b9c4"), rough=0.6)
    dancer = [cyl("dancer_pin", (0, 0, dz + 0.01), 0.0015, 0.02, gold, verts=8, bevel=0),
              lathe("dancer_tutu", [(0.002, 0.0), (0.03, 0.004), (0.026, 0.011), (0.006, 0.016)], tutu, (0, 0, dz + 0.03), segs=32,
                    wobble=lambda t: 1 + 0.08 * math.cos(9 * t)),
              cyl("dancer_leg", (0, 0, dz + 0.025), 0.0022, 0.03, dancer_m, verts=12, bevel=0),
              cyl("dancer_body", (0, 0, dz + 0.054), 0.0045, 0.026, dancer_m, verts=16, bevel=0.0015),
              sphere("dancer_head", (0, 0, dz + 0.073), 0.0055, dancer_m),
              sphere("dancer_bun", (0, 0.002, dz + 0.079), 0.0028, dancer_m)]
    for s in (-1, 1):                                               # arms raised in a circle overhead
        dancer.append(tube(f"dancer_arm_{s}", [(0, 0, dz + 0.064), (s * 0.012, 0, dz + 0.07), (s * 0.01, 0, dz + 0.086), (s * 0.002, 0, dz + 0.09)],
                           0.0012, dancer_m))
    parts += dancer
    box_root = group("music_box", Matrix.Translation((cx_, cy_, mb_z)) @ Matrix.Rotation(math.radians(205), 4, "Z"), parts)
    point_light("music_box_glow", (cx_ - 0.25, cy_ + 0.45, 1.5), 4 * GLOW, (1.0, 0.75, 0.5), radius=0.2)
    hotspot("music-box", "The music box", meshes_of(box_root), kind="ambient")

    # ---- The dessert sideboard on the hallway wall: four bell jars over finished desserts
    sx0, sy0, sy1 = W - 0.44, 0.35, 1.7
    sb = [box_span("sideboard", sx0, W, sy0, sy1, 0.08, 0.78, dark_oak, bevel=0.01),
          box_span("sideboard_top", sx0 - 0.02, W, sy0 - 0.02, sy1 + 0.02, 0.78, 0.82, oak, bevel=0.008)]
    for k, y in enumerate((0.69, 1.36)):
        box_span(f"sideboard_door_{k}", sx0 - 0.015, sx0, y - 0.3, y + 0.3, 0.14, 0.6, oak, bevel=0.008)
        box_span(f"sideboard_drawer_{k}", sx0 - 0.015, sx0, y - 0.3, y + 0.3, 0.63, 0.74, oak, bevel=0.008)
        sphere(f"sideboard_knob_{k}", (sx0 - 0.025, y, 0.685), 0.016, brass)
    for y in (sy0 + 0.04, sy1 - 0.04):
        for x in (sx0 + 0.04, W - 0.04):
            cyl(f"sideboard_foot_{x}_{y}", (x, y, 0.04), 0.025, 0.08, dark_oak, verts=16)
    runner = box_span("sideboard_runner", sx0 + 0.02, W - 0.05, sy0 + 0.05, sy1 - 0.05, 0.82, 0.824, damask, bevel=0)
    jx, top = (sx0 + W) / 2 - 0.01, 0.824

    def cloche(key, y, r, h):
        cyl(f"{key}_board", (jx, y, top + 0.01), r + 0.025, 0.02, oak, verts=48, bevel=0.004)
        cyl(f"{key}_plate", (jx, y, top + 0.024), r - 0.005, 0.008, ceramic, verts=48, bevel=0.003)
        prof = [(r, 0.0)] + [(r * math.cos(t), h * 0.18 + (h * 0.78) * math.sin(t)) for t in
                             [k / 12 * math.pi / 2 for k in range(13)]]
        dome = lathe(f"{key}_glass", [(r, 0.0), (r, h * 0.18)] + prof[2:], glass, (jx, y, top + 0.02), segs=64, shell=0.003)
        knob = sphere(f"{key}_knob", (jx, y, top + 0.02 + h * 0.96 + 0.018), 0.018, glass)
        return [dome, knob]

    def at(y, z=0.0):
        return (jx, y, top + 0.028 + z)

    # 1. fruit tart
    y = 0.56
    jar = cloche("jar_tart", y, 0.12, 0.2)
    tart = [lathe("tart_crust", [(0.0, 0.0), (0.085, 0.0), (0.092, 0.03), (0.084, 0.032), (0.0, 0.026)], crust, at(y),
                  wobble=lambda t: 1 + 0.04 * math.cos(22 * t))]
    tart.append(cyl("tart_custard", at(y, 0.027), 0.08, 0.006, cream, verts=48, bevel=0.002))
    for k in range(14):
        a, rr = k * 2.4, 0.018 + 0.055 * ((k * 5) % 7) / 6
        m_ = rasp if k % 3 else bluebe
        if m_ is rasp:
            tart.append(berry(f"tart_rasp_{k}", (jx + rr * math.cos(a), y + rr * math.sin(a), top + 0.07), 0.01, rasp, seed=80 + k))
        else:
            tart.append(sphere(f"tart_blue_{k}", (jx + rr * math.cos(a), y + rr * math.sin(a), top + 0.066), 0.008, bluebe))
    hotspot("jar-tart", "The fruit tart", jar + tart, kind="ambient")
    # 2. dark chocolate truffles
    y = 0.88
    jar = cloche("jar_truffles", y, 0.11, 0.16)
    tr = []
    for k, (ox, oy, oz) in enumerate(((0, 0, 0.04), (0.035, 0.0, 0.0), (-0.035, 0.0, 0.0), (0, 0.035, 0), (0, -0.035, 0),
                                      (0.03, 0.03, 0.0), (-0.03, -0.03, 0.0))):
        tr.append(sphere(f"truffle_{k}", (jx + ox, y + oy, top + 0.048 + oz), 0.02, cocoa if k % 2 else chocolate))
    hotspot("jar-truffles", "The truffles", jar + tr, kind="ambient")
    # 3. berry pavlova
    y = 1.2
    jar = cloche("jar_pavlova", y, 0.12, 0.2)
    pv = [lathe("pavlova_meringue", [(0.0, 0.0), (0.075, 0.0), (0.085, 0.02), (0.08, 0.045), (0.07, 0.055), (0.0, 0.05)], meringue,
                at(y), segs=64, wobble=lambda t: 1 + 0.07 * math.cos(11 * t))]
    pv.append(sphere("pavlova_cream", at(y, 0.056), 0.06, cream, scale=(1, 1, 0.35)))
    for k in range(11):
        a, rr = k * 2.4, 0.01 + 0.045 * ((k * 3) % 5) / 4
        pv.append(berry(f"pav_berry_{k}", (jx + rr * math.cos(a), y + rr * math.sin(a), top + 0.1), 0.011,
                        rasp if k % 2 else blackb, seed=100 + k, kind="rasp" if k % 2 else "black"))
    hotspot("jar-pavlova", "The pavlova", jar + pv, kind="ambient")
    # 4. yoghurt parfait in a tall glass
    y = 1.5
    jar = cloche("jar_parfait", y, 0.1, 0.27)
    pf = [lathe("parfait_glass", [(0.025, 0.0), (0.03, 0.006), (0.006, 0.02), (0.006, 0.05), (0.04, 0.07), (0.046, 0.21)], glass, at(y), shell=0.002)]
    for k, (z0, z1, m_) in enumerate(((0.072, 0.1, granola), (0.1, 0.13, cream), (0.13, 0.15, compote), (0.15, 0.175, cream), (0.175, 0.19, granola))):
        rr = 0.04 + (z0 - 0.07) * 0.04
        pf.append(cyl(f"parfait_layer_{k}", at(y, (z0 + z1) / 2), rr, z1 - z0, m_, verts=32, bevel=0.002))
    for k in range(5):
        pf.append(berry(f"parfait_berry_{k}", (jx + 0.02 * math.cos(k * 1.3), y + 0.02 * math.sin(k * 1.3), top + 0.235), 0.01, rasp, seed=120 + k))
    hotspot("jar-parfait", "The parfait", jar + pf, kind="ambient")

    # The culinary constellations, framed above the sideboard
    art = image_mat("constellations", os.path.join(PACK, "12-kitchen-constellations-flat.png"), rough=0.7)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(W - 0.026, 1.03, 1.62), rotation=(math.radians(90), 0, math.radians(-90)))
    chart = bpy.context.active_object
    chart.name = "star_chart"
    chart.scale = (0.5, 0.5, 1)
    bpy.ops.object.transform_apply(scale=True)
    chart.data.materials.append(art)
    for nm, y0, y1, z0, z1 in (("l", 0.75, 0.78, 1.34, 1.9), ("r", 1.28, 1.31, 1.34, 1.9), ("b", 0.75, 1.31, 1.34, 1.37), ("t", 0.75, 1.31, 1.87, 1.9)):
        box_span(f"chart_frame_{nm}", W - 0.035, W, y0, y1, z0, z1, gold, bevel=0.003)
    hotspot("star-chart", "The star chart", [chart], kind="ambient")

    # ---- The hallway door: old oak, four panels, the same as the hallway's (closed)
    lw, lh, lt = DOOR_W - 0.02, DOOR_H - 0.03, 0.045
    dparts = [box_span("door_leaf", 0, lw, -lt / 2, lt / 2, 0.012, 0.012 + lh, door_oak, bevel=0.004)]
    for px in (0.235, lw - 0.235):
        for pz0, pz1 in ((0.2, 0.95), (1.12, 1.95)):
            dparts.append(box_span(f"door_panel_{px}_{pz0}", px - 0.14, px + 0.14, -lt / 2 - 0.006, -lt / 2, pz0 + 0.02, pz1 - 0.02, door_oak, bevel=0.008))
            for nm, a0, a1, b0, b1 in (("l", px - 0.17, px - 0.145, pz0, pz1), ("r", px + 0.145, px + 0.17, pz0, pz1),
                                       ("b", px - 0.17, px + 0.17, pz0, pz0 + 0.025), ("t", px - 0.17, px + 0.17, pz1 - 0.025, pz1)):
                dparts.append(box_span(f"door_mould_{px}_{pz0}_{nm}", a0, a1, -lt / 2 - 0.014, -lt / 2, b0, b1, door_dark, bevel=0.005))
    dparts.append(cyl("door_knob", (lw - 0.07, -lt / 2 - 0.035, 1.0), 0.028, 0.05, brass_worn, rot=(math.radians(90), 0, 0)))
    for hz in (0.25, 1.85):
        dparts.append(cyl(f"door_hinge_{hz}", (0.005, 0, hz), 0.009, 0.1, iron))
    # local x runs along the wall toward the lane (-Y), local -y comes out of the wall into the room (-X)
    m = Matrix(((0, 1, 0), (-1, 0, 0), (0, 0, 1))).to_4x4()
    m.translation = Vector((W + 0.06, d1 - 0.01, 0))
    door_root = group("hall_door", m, dparts)
    for nm, y0, y1 in (("a", d0 - 0.08, d0), ("b", d1, d1 + 0.08)):
        box_span(f"door_trim_{nm}", W - 0.025, W, y0, y1, 0, DOOR_H + 0.08, paint, bevel=0.005)
    box_span("door_trim_t", W - 0.025, W, d0 - 0.08, d1 + 0.08, DOOR_H, DOOR_H + 0.09, paint, bevel=0.005)
    for y0, y1 in ((d0, d0 + 0.008), (d1 - 0.008, d1)):
        box_span(f"door_jamb_{y0:.2f}", W, W + 0.15, y0, y1, 0, DOOR_H, paint)
    box_span("door_head", W, W + 0.15, d0, d1, DOOR_H - 0.008, DOOR_H, paint)
    hotspot("ss-exit-door", "Into the hallway", meshes_of(door_root), kind="door")

    # ---- The room dial, the same as the hallway's, its pointer left on Sweet Spells (station 120)
    dial_face = image_mat("dial_face", os.path.join(HALL, "05-dial-plate-flat.png"), rough=0.35, circle=0.4825)
    dial_face.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    dial_r = 0.1
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.0035))
    face = bpy.context.active_object
    face.name = "ss_dial_face"
    face.scale = (2 * dial_r / 0.965,) * 2 + (1,)
    bpy.ops.object.transform_apply(scale=True)
    face.data.materials.append(dial_face)
    dl = [face, cyl("ss_dial_rim", (0, 0, 0), dial_r, 0.006, brass, verts=96, bevel=0.002)]
    for st in json.load(open(os.path.join(HALL, "dial-layout.json"), encoding="utf8"))["stations"]:
        if not st["label"]:
            continue
        a = math.radians(st["angle_clockwise_from_top_deg"])
        words = st["label"].split(" ")
        body = "\n".join(words) if len(words) > 1 else st["label"]
        size = 0.0042 if len(words) > 1 else (0.0036 if len(body) > 10 else 0.0044)
        dl.append(text(f"ss_dial_name_{st['index']}", body, (0.0785 * math.sin(a), 0.0785 * math.cos(a), 0.0045), (0, 0, 0), size, ink))
    ptr = [cyl("ss_hub", (0, 0, 0.012), 0.014, 0.012, brass_worn, bevel=0.003), sphere("ss_hub_cap", (0, 0, 0.019), 0.008, brass_worn)]
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.006, radius2=0.0025, depth=0.062, location=(0, 0.035, 0.012),
                                    rotation=(math.radians(-90), 0, 0))
    shaft = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    shaft.data.materials.append(brass_worn)
    ptr += [shaft, sphere("ss_pointer_tip", (0, 0.068, 0.012), 0.0065, brass_worn), sphere("ss_pointer_tail", (0, -0.026, 0.012), 0.006, brass_worn)]
    dl.append(group("ss_pointer_set", Matrix.Rotation(-math.radians(120), 4, "Z"), ptr))
    group("ss_dial", frame_matrix((W - 0.006, DIAL_AT[1], DIAL_AT[2]), (-1, 0, 0), (0, -1, 0)), dl)
    hotspot("ss-dial", "The dial", [face], kind="dial", overlay="dial")

    # ---- Back wall: spell books on oak shelves over a low cupboard, a brass lectern in front
    bx0, bx1, by_ = 0.65, 3.85, D
    box_span("book_cupboard", bx0, bx1, by_ - 0.4, by_, 0.06, 0.84, oak, bevel=0.01)
    box_span("book_cupboard_top", bx0 - 0.02, bx1 + 0.02, by_ - 0.42, by_, 0.84, 0.88, oak, bevel=0.008)
    box_span("book_cupboard_plinth", bx0 + 0.02, bx1 - 0.02, by_ - 0.38, by_, 0.0, 0.06, dark_oak)
    for k in range(4):
        x = bx0 + 0.4 + k * 0.8
        box_span(f"book_cupboard_door_{k}", x - 0.36, x + 0.36, by_ - 0.415, by_ - 0.4, 0.12, 0.78, oak, bevel=0.008)
        sphere(f"book_cupboard_knob_{k}", (x + (0.3 if k % 2 == 0 else -0.3), by_ - 0.43, 0.6), 0.014, brass)
    shelf_z = [1.32, 1.76, 2.2]
    shelves = []
    for z in shelf_z:
        shelves.append(box_span(f"book_shelf_{z}", bx0, bx1, by_ - 0.28, by_, z - 0.04, z, oak, bevel=0.006))
        for x in (bx0 + 0.15, (bx0 + bx1) / 2, bx1 - 0.15):
            box_span(f"book_bracket_{z}_{x:.2f}", x - 0.02, x + 0.02, by_ - 0.2, by_, z - 0.2, z - 0.04, oak, bevel=0.004)
    brnd = random.Random(21)
    books = []
    for si, z in enumerate([0.88] + shelf_z):
        x = bx0 + 0.06
        while x < bx1 - 0.08:
            if brnd.random() < 0.12:                                # a gap with an ornament or a candle
                gap = brnd.uniform(0.18, 0.28)
                kind = brnd.random()
                gx = x + gap / 2
                if si == 0:
                    pass                                            # the cupboard top stays clear behind the lectern
                elif kind < 0.35:
                    candle(f"shelf_candle_{si}_{len(books)}", (gx, by_ - 0.14, z), h=0.12, r=0.018)
                elif kind < 0.65:
                    model("ceramic_vase_01", (gx, by_ - 0.14, z), rot_z=brnd.uniform(0, 360), scale=0.45)
                else:
                    model("potted_plant_02", (gx, by_ - 0.14, z), rot_z=brnd.uniform(0, 360), scale=0.3)
                x += gap
                continue
            if si == 0 and abs(x - 2.25) < 0.45:                    # behind the lectern: leave it open
                x += 0.05
                continue
            t = brnd.uniform(0.03, 0.065)
            hgt = brnd.uniform(0.21, 0.31) if si else brnd.uniform(0.2, 0.27)
            if z + hgt > (shelf_z + [H])[si] - 0.06 if si < 3 else z + hgt > H - 0.1:
                hgt = 0.2
            dep = brnd.uniform(0.17, 0.23)
            lm = leather[brnd.randrange(len(leather))]
            lean = math.radians(brnd.choice([0, 0, 0, 0, 4, -3]))
            b = box(f"book_{si}_{len(books)}", (x + t / 2, by_ - 0.04 - dep / 2, z + hgt / 2), (t, dep, hgt), lm, bevel=0.003)
            b.rotation_euler = (0, lean, 0)
            books.append(b)
            for bz in (0.03, hgt - 0.03):                           # raised bands on the blank spine
                bd_ = box(f"book_band_{si}_{len(books)}_{bz:.2f}", (x + t / 2, by_ - 0.04 - dep - 0.001, z + bz), (t * 0.92, 0.004, 0.006), gold, bevel=0)
                bd_.rotation_euler = (0, lean, 0)
            x += t + brnd.uniform(0.002, 0.01)
    hotspot("spell-books", "The spell books", books + shelves, kind="interactive", overlay="flavour")

    # the brass lectern with the open book: a watercolour pavlova on the right page, the left one blank
    lx, ly = 2.25, 4.0
    lt_ = [lathe("lectern_foot", [(0.0, 0.0), (0.2, 0.0), (0.2, 0.02), (0.06, 0.06), (0.03, 0.12), (0.024, 0.9), (0.04, 0.95), (0.03, 1.0)],
                 brass, (lx, ly, 0))]
    tilt = math.radians(28)                                          # the rest leans back, the book faces the room (-Y)
    rest_c = Vector((lx, ly + 0.05, 1.08))
    rest = box("lectern_rest", tuple(rest_c), (0.5, 0.36, 0.015), brass, bevel=0.003)
    rest.rotation_euler = (tilt, 0, 0)
    lip = box("lectern_lip", (lx, ly - 0.115, 1.0), (0.5, 0.025, 0.03), brass, bevel=0.004)
    lip.rotation_euler = (tilt, 0, 0)
    lt_ += [rest, lip]
    nrm = Vector((0, -math.sin(tilt), math.cos(tilt)))               # out of the page
    cover = box("book_cover", tuple(rest_c + nrm * 0.012), (0.46, 0.33, 0.01), leather[1], bevel=0.003)
    cover.rotation_euler = (tilt, 0, 0)
    page_mat = image_mat("pavlova_page", os.path.join(PACK, "10-pavlova-page-flat.png"), rough=0.85)
    pages = []
    for side_, x_off in (("l", -0.112), ("r", 0.112)):
        bpy.ops.mesh.primitive_plane_add(size=1)
        pg = bpy.context.active_object
        pg.name = f"book_page_{side_}"
        pg.scale = (0.22, 0.31, 1)
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.subdivide(number_cuts=10)
        bpy.ops.object.mode_set(mode="OBJECT")
        for v in pg.data.vertices:                                   # pages curve up from the gutter
            u = (v.co.x + 0.11) / 0.22 if side_ == "r" else (0.11 - v.co.x) / 0.22
            v.co.z = 0.018 * math.sin(math.pi * min(u, 1) * 0.5) ** 0.6
        pg.matrix_world = Matrix.Translation(rest_c + nrm * 0.02) @ Matrix.Rotation(tilt, 4, "X") @ Matrix.Translation((x_off, 0, 0))
        pg.data.materials.append(page_mat if side_ == "r" else paper)
        for p in pg.data.polygons:
            p.use_smooth = True
        pages.append(pg)
    box("book_block", tuple(rest_c + nrm * 0.016), (0.45, 0.31, 0.008), paper, bevel=0.002).rotation_euler = (tilt, 0, 0)
    hotspot("lectern", "The open book", pages + [cover], kind="interactive", overlay="occasion")

    # ---- Hill wall: the hearth with its copper sugar pan, and the potion cabinet toward the bay
    hy0, hy1 = 2.2, 3.8
    oy0, oy1, oh = 2.6, 3.4, 0.86                                    # the fire opening
    hx = 0.5                                                         # face of the chimney breast
    box_span("breast_l", 0, hx, hy0, oy0, 0, 1.15, stone_m)
    box_span("breast_r", 0, hx, oy1, hy1, 0, 1.15, stone_m)
    box_span("breast_lintel", 0, hx, oy0, oy1, oh, 1.15, stone_m)
    box_span("firebox_back", 0, 0.08, oy0, oy1, 0, oh, mat("soot", srgb("#1c1714"), 0.95))
    box_span("firebox_floor", 0.08, hx, oy0, oy1, 0, 0.04, mat("ash", srgb("#3a3430"), 0.95))
    box_span("breast_upper", 0, hx - 0.06, hy0 + 0.05, hy1 - 0.05, 1.3, H, plaster)
    mantel = box_span("mantel", 0, hx + 0.1, hy0 - 0.1, hy1 + 0.1, 1.15, 1.3, beam_wood, bevel=0.015)
    box_span("hearth_stone", hx, hx + 0.45, hy0 + 0.1, hy1 - 0.1, 0, 0.05, stone_m, bevel=0.01)
    # fire: an iron basket, three logs, flames and embers
    grate = [box_span("grate_bar_f", 0.38, 0.4, oy0 + 0.12, oy1 - 0.12, 0.05, 0.2, iron)]
    for k in range(6):
        y = oy0 + 0.15 + k * 0.1
        grate.append(box_span(f"grate_rib_{k}", 0.15, 0.4, y - 0.008, y + 0.008, 0.08, 0.1, iron))
    for k, (y, rz) in enumerate(((2.92, 4), (3.08, -6), (3.0, 90))):
        lg = cyl(f"log_{k}", (0.26, y, 0.14 + 0.06 * (k == 2)), 0.05, 0.42 if k < 2 else 0.3, log_wood, verts=20, bevel=0.01,
                 rot=(0, math.radians(90), math.radians(rz)) if k < 2 else (math.radians(90), 0, math.radians(10)))
    ember = mat("embers", srgb("#3a1a0a"), rough=0.8, emission=(1.0, 0.3, 0.05, 1), strength=4)
    cyl("ember_bed", (0.26, 3.0, 0.1), 0.17, 0.03, ember, verts=24, bevel=0.01)
    fire = mat("fire", (1, 0.6, 0.2, 1), emission=(1.0, 0.5, 0.12, 1), strength=26)
    frnd = random.Random(4)
    for k in range(9):
        fx, fy = 0.26 + frnd.uniform(-0.06, 0.06), 3.0 + frnd.uniform(-0.15, 0.15)
        hgt = frnd.uniform(0.1, 0.24)
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.035, radius2=0.002, depth=hgt, location=(fx, fy, 0.2 + hgt / 2))
        f = bpy.context.active_object
        f.name = f"flame_{k}"
        f.rotation_euler = (frnd.uniform(-0.2, 0.2), frnd.uniform(-0.2, 0.2), 0)
        bpy.ops.object.shade_smooth()
        f.data.materials.append(fire)
        f.visible_shadow = False
    for k, (y, wts) in enumerate(((2.9, 18), (3.1, 18))):
        point_light(f"fire_light_{k}", (0.45, y, 0.35), wts * GLOW, (1.0, 0.45, 0.15), radius=0.1)
    # the copper sugar pan on a little iron trivet at the front of the fire, rose steam curling up and out
    box_span("trivet", 0.36, 0.56, 2.9, 3.1, 0.36, 0.375, iron)
    for x in (0.38, 0.54):
        for y in (2.92, 3.08):
            cyl(f"trivet_leg_{x}_{y}", (x, y, 0.18), 0.006, 0.36, iron, verts=8, bevel=0)
    pan = [lathe("sugar_pan", [(0.0, 0.0), (0.07, 0.0), (0.1, 0.03), (0.11, 0.07), (0.112, 0.075)], copper, (0.46, 3.0, 0.375), segs=48, shell=0.003)]
    pan.append(cyl("sugar_pan_handle", (0.71, 3.0, 0.43), 0.009, 0.3, iron, rot=(0, math.radians(80), 0)))
    pan.append(cyl("sugar_syrup", (0.46, 3.0, 0.42), 0.1, 0.006, mat("rose_syrup", srgb("#9c2f48"), rough=0.1, coat=0.6, emission=srgb("#c24060"), strength=0.4), bevel=0))
    steam_pts, radii = [], []
    for j in range(12):
        t = j / 11
        steam_pts.append((0.46 + 0.35 * t + 0.05 * math.sin(t * 7), 3.0 + 0.09 * math.sin(t * 5.5), 0.45 + 1.0 * t))
        radii.append(0.5 + 2.2 * t)
    steam = tube("rose_steam", steam_pts, 0.035, volume_mat("rose_steam", "#e6a3b6", 6.0), radii=radii, res=6)
    steam.visible_shadow = False
    hotspot("sugar-pan", "The sugar pan", pan, kind="ambient")
    candle("mantel_candle_a", (0.3, hy0 + 0.05, 1.3), h=0.18)
    candle("mantel_candle_b", (0.3, hy1 - 0.05, 1.3), h=0.14)
    model("jug_01", (0.3, 3.25, 1.3), rot_z=90, scale=0.8)
    model("potted_plant_02", (0.28, 2.75, 1.3), rot_z=30, scale=0.35)
    model("wicker_basket_02", (0.75, 3.95, 0), rot_z=-20, scale=1.3)
    for k in range(3):
        cyl(f"spare_log_{k}", (0.75, 3.95 + 0.06 * (k - 1), 0.16 + 0.03 * (k == 1)), 0.035, 0.32, log_wood, verts=16, bevel=0.008,
            rot=(0, math.radians(90), math.radians(-20)))

    # potion cabinet: cupboard below, a glazed case of softly glowing bottles above
    px0, px1, py0, py1 = 0.0, 0.45, 0.95, 1.85
    cab = [box_span("cab_lower", px0, px1, py0, py1, 0.06, 0.86, oak, bevel=0.01),
           box_span("cab_counter", px0, px1 + 0.03, py0 - 0.02, py1 + 0.02, 0.86, 0.9, oak, bevel=0.006),
           box_span("cab_back", px0, 0.03, py0, py1, 0.9, 2.0, dark_oak),
           box_span("cab_side_a", px0, px1 - 0.02, py0, py0 + 0.03, 0.9, 2.0, oak),
           box_span("cab_side_b", px0, px1 - 0.02, py1 - 0.03, py1, 0.9, 2.0, oak),
           box_span("cab_cornice", px0, px1 + 0.04, py0 - 0.04, py1 + 0.04, 2.0, 2.1, oak, bevel=0.01),
           box_span("cab_plinth", px0, px1 - 0.02, py0 + 0.02, py1 - 0.02, 0.0, 0.06, dark_oak)]
    for k, (y0, y1) in enumerate(((py0 + 0.03, (py0 + py1) / 2 - 0.005), ((py0 + py1) / 2 + 0.005, py1 - 0.03))):
        cab.append(box_span(f"cab_door_lo_{k}", px1, px1 + 0.015, y0, y1, 0.12, 0.8, oak, bevel=0.008))
        cab.append(sphere(f"cab_knob_lo_{k}", (px1 + 0.03, y1 - 0.06 if k == 0 else y0 + 0.06, 0.62), 0.014, brass))
        for nm, a0, a1, b0, b1 in (("l", y0, y0 + 0.04, 0.92, 1.97), ("r", y1 - 0.04, y1, 0.92, 1.97),
                                   ("b", y0, y1, 0.92, 0.96), ("t", y0, y1, 1.93, 1.97), ("m", y0, y1, 1.43, 1.46)):
            cab.append(box_span(f"cab_door_frame_{k}_{nm}", px1 - 0.02, px1, a0, a1, b0, b1, oak, bevel=0.004))
        g = box_span(f"cab_glass_{k}", px1 - 0.013, px1 - 0.009, y0 + 0.02, y1 - 0.02, 0.94, 1.95, window_glass(f"cab_glass_{k}"))
        g.visible_shadow = False
        cab.append(sphere(f"cab_knob_hi_{k}", (px1 + 0.012, y1 - 0.06 if k == 0 else y0 + 0.06, 1.4), 0.012, brass))
    levels = [0.9, 1.2, 1.5, 1.78]
    for z in levels[1:]:
        cab.append(box_span(f"cab_shelf_{z}", 0.03, px1 - 0.03, py0 + 0.03, py1 - 0.03, z - 0.02, z, oak))
    liquids = [("#6e2036", 2.5), ("#a96420", 2.0), ("#8a1f3a", 2.5), ("#5a3a20", 0.6), ("#e0c890", 0.8), ("#d98aa0", 1.6),
               ("#c98a2a", 1.8), ("#7a1528", 2.2)]
    lmats = [glow_liquid(f"potion_{i}", c, s) for i, (c, s) in enumerate(liquids)]
    cork = mat("cork", srgb("#a7895e"), rough=0.9)
    prnd = random.Random(31)
    bottles = []
    for li, z in enumerate(levels):
        y = py0 + 0.1
        while y < py1 - 0.1:
            r = prnd.uniform(0.028, 0.045)
            h = prnd.uniform(0.09, 0.2) if li < 3 else prnd.uniform(0.08, 0.15)
            x = 0.2 + prnd.uniform(-0.04, 0.04)
            shape = prnd.random()
            if shape < 0.4:                                          # a round flask with a neck
                prof = [(0.0, 0.0), (r * 0.7, 0.0), (r, h * 0.25), (r, h * 0.45), (r * 0.35, h * 0.7), (r * 0.3, h * 0.92), (r * 0.36, h)]
            elif shape < 0.75:                                       # a straight apothecary bottle
                prof = [(0.0, 0.0), (r, 0.0), (r, h * 0.7), (r * 0.45, h * 0.82), (r * 0.42, h * 0.95), (r * 0.48, h)]
            else:                                                    # a squat jar (dates, cacao, honey)
                r *= 1.2
                h *= 0.7
                prof = [(0.0, 0.0), (r, 0.0), (r, h * 0.85), (r * 0.8, h)]
            bt = lathe(f"bottle_{li}_{len(bottles)}", prof, glass, (x, y, z), segs=32, shell=0.0025)
            fill = [(max(rr - 0.004, 0.0005), zz) for rr, zz in prof if zz < h * 0.62] or [(0, 0), (r * 0.9, h * 0.5)]
            fill = fill + [(fill[-1][0], h * 0.62), (0.0004, h * 0.62)]
            lathe(f"bottle_fill_{li}_{len(bottles)}", fill, lmats[prnd.randrange(len(lmats))], (x, y, z + 0.004), segs=32)
            cyl(f"bottle_cork_{li}_{len(bottles)}", (x, y, z + h + 0.01), prof[-1][0] * 0.95, 0.025, cork, verts=16, bevel=0.003)
            bottles.append(bt)
            y += 2 * r + prnd.uniform(0.012, 0.03)
        point_light(f"cab_glow_{li}", (0.32, (py0 + py1) / 2, z + 0.12), 1.6 * GLOW, (1.0, 0.45, 0.3), radius=0.08)
    model("potted_plant_02", (0.22, 1.4, 2.1), rot_z=10, scale=0.45)
    hotspot("potion-cabinet", "The potion cabinet", bottles, kind="interactive", overlay="level-up")

    # ---- Wall lamps: brass sconces with warm bulbs (hallway wall, and either end of the bookshelves)
    bulb = mat("bulb", (1, 0.85, 0.6, 1), emission=(1.0, 0.72, 0.42, 1), strength=18)

    def wall_lamp(name, at_, normal, watts=10):
        n = Vector(normal)
        right = Vector((0, 0, 1)).cross(n)
        parts_ = [cyl(f"{name}_plate", (0, 0, 0.008), 0.05, 0.016, brass, bevel=0.003),
                  cyl(f"{name}_arm", (0, 0.04, 0.11), 0.008, 0.2, brass),
                  cyl(f"{name}_arm2", (0, 0.11, 0.2), 0.008, 0.16, brass, rot=(math.radians(90), 0, 0))]
        bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.09, radius2=0.035, depth=0.09, end_fill_type="NOTHING", location=(0, 0.13, 0.22))
        shade = bpy.context.active_object
        shade.name = f"{name}_shade"
        shade.rotation_euler = (math.radians(-90), 0, 0)
        shade.modifiers.new("thick", "SOLIDIFY").thickness = 0.003
        bpy.ops.object.shade_smooth()
        shade.data.materials.append(brass)
        parts_ += [shade, sphere(f"{name}_bulb", (0, 0.1, 0.22), 0.024, bulb if WX["lamps"] else glass)]
        group(name, frame_matrix(at_, normal, right), parts_)
        if WX["lamps"]:                                          # on when it's dark out, off on a bright day
            point_light(f"{name}_light", Vector(at_) + n * 0.22 + Vector((0, 0, 0.1)), watts * WX["lamps"], (1.0, 0.66, 0.38), radius=0.04)

    wall_lamp("lamp_hall", (W, 2.1, 1.85), (-1, 0, 0))
    wall_lamp("lamp_back_l", (0.35, D, 1.85), (0, -1, 0))
    wall_lamp("lamp_back_r", (4.15, D, 1.85), (0, -1, 0))

    # ---- Rug under the table
    box_span("rug", tx - 1.2, tx + 1.2, ty - 0.85, ty + 0.95, 0, 0.012, damask, bevel=0.004)

    # ---- Light: the weather's sky through the bay, warm practicals inside
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "kloofendal_overcast_puresky.hdr"))
    tint = wnt.nodes.new("ShaderNodeMix")
    tint.data_type, tint.blend_type = "RGBA", "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = (*WX["tint"], 1)
    wnt.links.new(env.outputs["Color"], tint.inputs[6])
    wnt.links.new(tint.outputs[2], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = WX["sky"]
    if WX["sun"]:
        watts, colour, elev, azim = WX["sun"]
        sun = bpy.data.lights.new("sun", "SUN")
        sun.energy, sun.color, sun.angle = watts, colour, math.radians(1.5)
        so = bpy.data.objects.new("sun", sun)
        # in through the bay: from the lane (-Y), down, a little across
        d = Vector((math.sin(math.radians(azim)), math.cos(math.radians(azim)), -math.tan(math.radians(elev)))).normalized()
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(so)
    for fi, (p, q) in enumerate(zip(BAY[:-1], BAY[1:])):
        mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (SILL + HEAD) / 2)
        ang = math.atan2(q[1] - p[1], q[0] - p[0])
        # an area light emits along its -Z: turn it to face into the room (the left of p->q)
        area_light(f"bay_portal_{fi}", mid, (math.radians(90), 0, ang), (math.dist(p, q), HEAD - SILL), 0, (1, 1, 1), portal=True)
    bounce = area_light("bay_bounce", (W / 2, 0.05, 1.4), (math.radians(90), 0, 0), (2.4, 1.4), WX["bounce"][0], WX["bounce"][1])
    bounce.visible_camera = bounce.visible_glossy = False
    point_light("warm_fill", (2.0, 2.6, 2.4), WX["fill"], (1.0, 0.68, 0.4), radius=0.8)

    # ---- Render settings
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = 128 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 10
    scene.cycles.transparent_max_bounces = 24
    scene.cycles.volume_bounces = 1
    scene.cycles.volume_step_rate = 2.0
    scene.render.resolution_x = 2048 if PREVIEW else 8192
    scene.render.resolution_y = 1024 if PREVIEW else 4096
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = WX["exposure"]
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def visible_from(cam, hs):
    deps = bpy.context.evaluated_depsgraph_get()
    origin = Vector(cam)
    target = Vector(hs["center"])
    d = target - origin
    dist = d.length
    ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(deps, origin, d.normalized(), distance=dist)
    if not ok:
        return True
    if obj and (obj.name in hs["objects"] or "glass" in obj.name or obj.name.startswith(("bay_pane", "spark_", "rose_steam", "bottle"))):
        return True
    return (loc - origin).length > dist - 0.15


def stop_hotspots(cam):
    out = {}
    for key, hs in HOTSPOTS.items():
        yaw, pitch = look(cam, hs["center"], cam[2])
        yaw = round((yaw - CAM_YAW + 540) % 360 - 180, 2)          # relative to the middle of the panorama
        out[key] = {"label": hs["label"], "type": hs["type"], "overlay": hs["overlay"], "yaw": yaw, "pitch": pitch,
                    "distance": round((Vector(hs["center"]) - Vector(cam)).length, 2), "visible": visible_from(cam, hs)}
    return out


def main():
    build()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "sweet_spells.blend"))
    scene = bpy.context.scene
    data = {"room": "sweet-spells", "stops": {"middle": {"position": list(CAM), "hotspots": stop_hotspots(CAM)}}}
    with open(os.path.join(OUT, "sweet_spells_hotspots.json"), "w") as fh:
        json.dump(data, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)")
        return
    pano_camera(scene, CAM, CAM_YAW)
    scene.render.filepath = os.path.join(OUT, f"sweet_spells_pano_{WEATHER}{'_night' if NIGHT else '_' + TIME if TIME else ''}{'_preview' if PREVIEW else ''}.jpg")
    bpy.ops.render.render(write_still=True)
    print(f"[whisked] rendered {WEATHER}{' night' if NIGHT else ''}")
    print("[whisked] done")


main()

# MOVES LATER (the renders are stills; these could be animated over the panorama, or as short loops):
# - the whisk turning slowly on its tilted axis, with a small bob (whisk_* objects)
# - the floating raspberries drifting 5-15 mm, the chocolate ribbon flowing, the gold sparks twinkling
# - the rose steam curling up from the sugar pan; the fire and candle flames flickering
# - the music box: lid opening, the dancer rising and turning while it plays
# - the potion bottles' glow breathing gently
