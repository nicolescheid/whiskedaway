"""
The garden: the Inn's outdoor room, out through Flourish's stable door. A patio with a long table under string lights,
the kettle barbecue, a wood-fired pizza oven, the kitchen garden's raised beds beside the glasshouse, and a camp on
the lawn (a bell tent, a fire pit and a camp oven on a tripod), a dry-stone wall on the cliff, the sea beyond.
Renders a 360 equirectangular panorama from each stop in each barometer weather, by day or at night, and writes the
hotspot angles for the browser viewer. Plan: side-session-notes garden-plan.md (23 Oct 2026).

Everything is in Flourish's coordinates (X = Flourish's hallway wall 0 to its garden wall 4.5, outer face 4.8; Y = its
front wall 0 to its sea wall 4.5, outer face 4.8). The glasshouse is at x + 4.8, y - 4.65 of its own coordinates.
Both rooms are built by their own scripts (--no-render) and appended here, so the stable door, the barbecue on its
plinth, the glasshouse and the kitchen seen through the door's open top are exactly what those rooms render.

Needs the Poly Haven assets:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/garden_build.py -- [--stop=patio|camp] [--weather=fair] [--night]
          [--preview | --quick | --both] [--no-render]   (--stop=all renders both stops from one build)
"""
import bpy
import hashlib
import json
import math
import os
import random
import shutil
import subprocess
import sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import (ASSETS, ART, HERE, OUT, bbox, box_span, center_of, cyl, look, mat, meshes_of, model,  # noqa: E402
                     pano_camera, pbr, point_light, retint, sphere, srgb, use_gpu)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
QUICK = "--quick" in ARGS                 # a small, noisy look for checking the layout, never shipped
BOTH = "--both" in ARGS                   # the 8K and the preview from one build
NO_RENDER = "--no-render" in ARGS
NIGHT = "--night" in ARGS
WEATHER = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--weather=")), "fair")
STOP = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--stop=")), "patio")   # or "all": both stops from one build
ROOM = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--room=")), None)   # flourish | glasshouse: that room's own
                                          # panorama (its camera, light and weather), the real garden outside instead of the plate
if ROOM:
    STOP = "patio"
SEASON = "spring"                         # the glasshouse and the far view; the garden has no seasons yet

os.makedirs(OUT, exist_ok=True)
GH_PACK = os.path.join(ART, "glasshouse")

EYE = 1.6
GROUND = -0.1                              # the lawn; the patio flags are at -0.05, Flourish's floor at 0
STOPS = {"patio": ((6.5, 3.0, EYE), 90),   # just out of the stable door; the middle of the panorama looks over the garden
         "camp": ((11.0, 3.3, EYE), 45)}   # by the fire pit; the middle looks at the tent and the sea
CAM, CAM_YAW = STOPS["patio" if STOP == "all" else STOP]
ROOM_CAMS = {"flourish": ((2.2, 1.4, EYE), 0),                  # flourish_build.py's camera
             "glasshouse": ((0.8 + 4.8, 3.15 - 4.65, EYE), 90)}   # glasshouse_build.py's, moved into place

GH_DX, GH_DY = 4.8, -4.65                  # glasshouse coordinates -> these
SD_Y, SD_W, SD_H = 3.8, 0.9, 2.05          # Flourish's stable door (flourish_build.py)
CD_Y, CD_W, CD_H = 1.9 + GH_DY, 0.85, 2.0  # the glazed door from the glasshouse into the Chiapothecary
INN_FRONT, INN_SEA, INN_BACK = -4.95, 4.8, -8.0    # the Inn's lane face, sea face, and far enough toward the hill
EAVES, RIDGE_Z = 5.4, 8.2
RIDGE_Y = (INN_FRONT + INN_SEA) / 2
PIT = (12.2, 5.2)                          # the camp's fire pit
TENT = (14.6, 7.0)                         # the bell tent's centre
OVEN = (8.3, 6.6)                         # the pizza oven
TABLE_C, TABLE_S = (8.6, 3.6), (2.0, 0.9, 0.76)
CLIFF_Y = 9.4                              # the dry-stone wall along the cliff
SIDE_X = 17.1                              # the far wall, toward the headland
LANE_Y = -6.5                              # the hedge on the lane side

# One look per barometer reading. hdri: the sky (Poly Haven kloofendal); sun_az: where its sun is turned to (degrees from
# +X toward +Y); plate: the glasshouse's outside view ('dry', 'wet' or 'night'), graded by strength/sat/mul/haze as in
# glasshouse_build.py; wet: 0 dry .. 1 soaked (darker, glossier ground, puddles); rain: streaks in the air (0 none, 1, 2);
# fire: the camp fire burns; shut: the tent's door is laced shut; lawn: grass tint and how much of it.
CLEAR, HIGH, MISTY, OVERCAST = ("kloofendal_38d_partly_cloudy_puresky", "kloofendal_48d_partly_cloudy_puresky",
                                "kloofendal_28d_misty_puresky", "kloofendal_overcast_puresky")
WEATHERS = {
    "fair":     dict(hdri=CLEAR, sky=1.0, sun_az=25, plate="dry", strength=1.0, sat=1.12, mul=None, haze=0.0, wet=0.0,
                     rain=0, fire=True, shut=False, lawn=("#6f8f45", 0.35), exposure=0.35),
    "very-dry": dict(hdri=HIGH, sky=1.05, sun_az=25, plate="dry", strength=1.05, sat=0.88, mul=(1.07, 1.0, 0.84), haze=0.12,
                     wet=0.0, rain=0, fire=True, shut=False, lawn=("#a99a5a", 0.55), exposure=0.25),
    "change":   dict(hdri=MISTY, sky=1.1, sun_az=40, plate="dry", strength=0.9, sat=1.0, mul=(0.95, 0.97, 1.0), haze=0.05,
                     wet=0.1, rain=0, fire=True, shut=False, lawn=("#6a8a48", 0.35), exposure=0.3),
    "rain":     dict(hdri=OVERCAST, sky=1.1, sun_az=0, plate="wet", strength=0.95, sat=1.0, mul=None, haze=0.0, wet=0.6,
                     rain=1, fire=False, shut=False, lawn=("#58763f", 0.4), exposure=0.6),
    "stormy":   dict(hdri=OVERCAST, sky=0.55, sun_az=0, plate="wet", strength=0.6, sat=0.9, mul=(0.85, 0.9, 1.0), haze=0.0,
                     wet=0.85, rain=2, fire=False, shut=True, lawn=("#4f6a3c", 0.45), exposure=0.7),
}
WX = dict(WEATHERS[WEATHER])
PLATES = {"dry": "13-outside-spring.png", "wet": "20-outside-spring-wet.png", "night": "24-outside-spring-night.png"}
if NIGHT:
    # Late night: the same weather after dark, the string lights and the tent's lantern lit, embers in the oven
    WX.update(plate="night", strength=0.9, sat=1.0, mul=None, haze=0.0, sky=0.04, exposure=0.9)
LIT = NIGHT                                # string lights, lantern, the Inn's windows

HOTSPOTS = {}


# ---------------------------------------------------------------- helpers

def hotspot(key, label, target, kind="interactive", overlay=None, appliance=None, stops=None, go=None):
    if isinstance(target, (list, tuple)) and target and hasattr(target[0], "name"):
        objs = []
        for t in target:
            objs += meshes_of(t) or [t]
    elif hasattr(target, "name"):
        objs = meshes_of(target) or [target]
    else:
        objs = []
    c = center_of(objs) if objs else list(target)
    HOTSPOTS[key] = {"label": label, "type": kind, "overlay": overlay, "center": [round(v, 3) for v in c],
                     "objects": [o.name for o in objs], "stops": stops}
    if appliance:
        HOTSPOTS[key]["appliance"] = appliance
    if go:
        HOTSPOTS[key]["go"] = go


def mesh_obj(name, verts, faces, material, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    if material:
        o.data.materials.append(material)
    return o


def world_origin(o):
    """Move the object's origin to the world origin, so box-projected textures line up across neighbouring pieces."""
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix()
    return o


def join(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        for m in o.modifiers:
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return world_origin(o)


def rod(name, p0, p1, r, material, verts=12):
    """A cylinder from p0 to p1."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    o = cyl(name, tuple((a + b) / 2), r, d.length, material, verts=verts, bevel=0)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.normalized().to_track_quat("Z", "Y")
    return o


def lathe(name, profile, material, loc, segs=40, thick=0.0, cap=True, scale=(1, 1, 1)):
    """A turned shape from a (radius, height) profile, bottom first."""
    verts, faces = [], []
    for r, z in profile:
        for i in range(segs):
            a = 2 * math.pi * i / segs
            verts.append((r * math.cos(a) * scale[0], r * math.sin(a) * scale[1], z * scale[2]))
    for k in range(len(profile) - 1):
        for i in range(segs):
            a, b = k * segs + i, k * segs + (i + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    if cap and profile[0][0] > 0:
        verts.append((0, 0, profile[0][1] * scale[2]))
        c = len(verts) - 1
        faces += [(c, (i + 1) % segs, i) for i in range(segs)]
    o = mesh_obj(name, verts, faces, material)
    o.location = loc
    if thick:
        o.modifiers.new("thick", "SOLIDIFY").thickness = thick
    return o


def catenary(p0, p1, sag, n):
    a, b = Vector(p0), Vector(p1)
    return [a.lerp(b, t) - Vector((0, 0, 4 * sag * t * (1 - t))) for t in (i / n for i in range(n + 1))]


def kit(aid, keep=None, tint=None):
    """Import a Poly Haven model and keep its pieces as hidden sources for place(): each piece is re-based so its
    footprint is centred on the origin and its foot on z = 0."""
    root = model(aid, (0, 0, 0))
    if tint:
        retint(root, *tint) if isinstance(tint, tuple) else retint(root, tint)
    pieces = []
    for o in meshes_of(root):
        o.hide_render = o.hide_viewport = True
        if keep and not any(k in o.name for k in keep):
            continue
        lo, hi = bbox([o])
        base = Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])) @ o.matrix_world.copy()
        pieces.append((o, base, [hi[i] - lo[i] for i in range(3)]))
    return pieces


def place(piece, loc, rot_z=0.0, scale=1.0, name=None, size=None):
    """A linked copy of a kit piece (it shares the mesh, so a lawn of them stays light). size: its width in metres."""
    src, base, dims = piece
    if size:
        scale = size / max(dims[0], dims[1])
    o = src.copy()
    o.parent = None
    o.name = name or src.name + "_i"
    bpy.context.scene.collection.objects.link(o)
    s = scale if isinstance(scale, (tuple, list)) else (scale,) * 3
    o.matrix_world = (Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rot_z), 4, "Z")
                      @ Matrix.Diagonal((*s, 1.0)) @ base)
    o.hide_render = o.hide_viewport = False
    return o


def emit(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = color
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


def canvas_mat(name, colour, glow):
    """Cotton canvas: a little light comes through it (a lantern inside makes the tent glow at night)."""
    m = pbr(name, "rough_linen", 0.25, tint=srgb(colour), tint_mix=0.85, bump=0.4)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
    tr.inputs["Color"].default_value = srgb("#f2d9a8")
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = glow
    out = nt.nodes["Material Output"]
    nt.links.new(p.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def backdrop_mat(name, path, strength=1.0, sat=1.12, mul=None, haze=0.0):
    """The far view: glows by itself, fades out at the top so the real sky (the HDRI) takes over (glasshouse_build.py)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    t.interpolation = "Cubic"
    t.extension = "EXTEND"
    hs = nt.nodes.new("ShaderNodeHueSaturation")
    hs.inputs["Saturation"].default_value = sat
    nt.links.new(t.outputs["Color"], hs.inputs["Color"])
    col = hs.outputs["Color"]
    if mul:
        mm = nt.nodes.new("ShaderNodeMix")
        mm.data_type, mm.blend_type = "RGBA", "MULTIPLY"
        mm.inputs["Factor"].default_value = 1.0
        nt.links.new(col, mm.inputs[6])
        mm.inputs[7].default_value = (*mul, 1)
        col = mm.outputs[2]
    if haze:
        hz = nt.nodes.new("ShaderNodeMix")
        hz.data_type = "RGBA"
        hz.inputs["Factor"].default_value = haze
        nt.links.new(col, hz.inputs[6])
        hz.inputs[7].default_value = (0.82, 0.79, 0.72, 1)
        col = hz.outputs[2]
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Strength"].default_value = strength
    nt.links.new(col, e.inputs["Color"])
    uv = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
    fade = nt.nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = 0.5       # just above the far hills: the real sky (the sun's in it) does the rest
    fade.inputs["From Max"].default_value = 0.6
    nt.links.new(sep.outputs["Y"], fade.inputs["Value"])
    # and at both ends, so where the curve stops the picture melts into the real sky
    gone = fade.outputs["Result"]
    for a, b in ((0.1, 0.0), (0.9, 1.0)):
        end = nt.nodes.new("ShaderNodeMapRange")
        end.inputs["From Min"].default_value, end.inputs["From Max"].default_value = a, b
        nt.links.new(sep.outputs["X"], end.inputs["Value"])
        mx = nt.nodes.new("ShaderNodeMath")
        mx.operation = "MAXIMUM"
        nt.links.new(gone, mx.inputs[0])
        nt.links.new(end.outputs["Result"], mx.inputs[1])
        gone = mx.outputs[0]
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(gone, mix.inputs[0])
    nt.links.new(e.outputs[0], mix.inputs[1])
    nt.links.new(clear.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


# ---------------------------------------------------------------- the neighbouring rooms, built by their own scripts

def room_blend(script, args):
    """Run another room's build (--no-render) once per set of arguments and keep its .blend. That build also rewrites
    its own hotspots file in out/, which is put back as it was."""
    key = hashlib.sha1(" ".join([script] + args).encode()).hexdigest()[:10]
    dest = os.path.join(OUT, f"_garden_src_{script.split('_')[0]}_{key}.blend")
    src_py = os.path.join(HERE, script)
    if os.path.exists(dest) and os.path.getmtime(dest) > os.path.getmtime(src_py):
        return dest
    room = script.replace("_build.py", "")
    hs = os.path.join(OUT, f"{room}_hotspots.json")
    keep = open(hs, "rb").read() if os.path.exists(hs) else None
    cmd = [bpy.app.binary_path, "-b", "--factory-startup", "--python", src_py, "--", *args, "--no-render"]
    print("[whisked] building", " ".join(cmd[-len(args) - 4:]))
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
    if keep is not None:
        with open(hs, "wb") as fh:
            fh.write(keep)
    if r.returncode != 0 or not os.path.exists(os.path.join(OUT, f"{room}.blend")):
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise RuntimeError(f"{script} failed")
    shutil.move(os.path.join(OUT, f"{room}.blend"), dest)
    return dest


def append_room(path, skip, offset=(0, 0, 0), keep_sun=False):
    """Append a room's objects (not its cameras or sun, nor anything named in skip) and shift them by offset."""
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if (keep_sun or n != "sun") and not n.startswith(skip)]
    objs = [o for o in dst.objects if o is not None and o.type != "CAMERA"]
    names = {o.name for o in objs}
    shift = Matrix.Translation(offset)
    for o in objs:
        bpy.context.scene.collection.objects.link(o)
    for o in objs:
        if o.parent is None:                     # (matrix_world isn't evaluated yet after an append: use the basis)
            o.matrix_basis = shift @ o.matrix_basis
    bpy.context.view_layer.update()
    return objs


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rnd = random.Random(23)
    wet = WX["wet"]

    room_args = [f"--weather={WEATHER}"] + (["--night"] if NIGHT else [])
    fl = room_blend("flourish_build.py", room_args)
    gh = room_blend("glasshouse_build.py", room_args + [f"--season={SEASON}"])
    # Flourish: the room, its stable door, the barbecue on its plinth; not its window views, its garden wall (built
    # here with the Inn's outside face) or its patio (here, as one piece with the rest of the flags)
    # (--room=flourish keeps its sea window and its own sun; only the garden plate goes)
    append_room(fl, ("view_garden", "garden_patio", "garden_step") if ROOM == "flourish"
                else ("view_", "wall_garden", "garden_patio", "garden_step"), keep_sun=ROOM == "flourish")
    # The glasshouse, moved into place: not its garden view, its gravel, or the Inn wall it leans on (built here)
    # (--room=glasshouse keeps its Inn wall, landing window and the shop seen through the glazed door)
    append_room(gh, ("garden_view", "ground_") if ROOM == "glasshouse"
                else ("garden_view", "ground_", "inn_wall_", "landing_window", "shop_glimpse", "still_"), (GH_DX, GH_DY, 0))
    if NIGHT:
        # the barbecue's smoke wisp catches the string lights and reads as a little white ghost: no smoke after dark
        for o in bpy.data.objects:
            if o.name.startswith("app_bbq_smoke"):
                o.hide_render = True

    # ---- Materials
    lime = pbr("limewash", "plastered_stone_wall", 2.2, tint=srgb("#efe6d2"), tint_mix=0.55, bump=0.8)
    slate = pbr("slate", "roof_slates_02", 1.6, tint=srgb("#5d646a"), tint_mix=0.3, rough_add=-0.25 * wet)
    drystone = pbr("drystone", "stacked_stone_wall", 1.4, tint=srgb("#b5ab98"), tint_mix=0.25, rough_add=-0.3 * wet, bump=1.0)
    flags = pbr("brick", "terracotta_floor_tiles", 0.8, tint=srgb("#7a6a5c") if wet else None, tint_mix=0.25 * wet * 2,
                rough_add=-0.45 * wet)
    brick = pbr("red_brick", "brick_4", 1.2, rough_add=-0.3 * wet)
    lawn_c, lawn_mix = WX["lawn"]
    lawn = pbr("lawn", "leafy_grass", 2.5, tint=srgb(lawn_c), tint_mix=lawn_mix, rough_add=-0.3 * wet)
    soil = pbr("soil", "farm_soil", 1.0, tint=srgb("#3a2c20") if wet else None, tint_mix=0.4, rough_add=-0.3 * wet, bump=1.0)
    planks = pbr("bed_timber", "worn_planks", 1.2, tint=srgb("#8a7a64"), tint_mix=0.3)
    oak = pbr("oak", "wood_table_worn", 1.0, tint=srgb("#9c7b55"), tint_mix=0.3, rough_add=-0.2 * wet)
    sage = pbr("sage_table", "wood_table_worn", 1.0, tint=srgb("#8d9b80"), tint_mix=0.75, rough_add=-0.2 * wet)
    cream = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    iron = mat("iron", srgb("#2a2622"), 0.6, 0.8)
    linen = pbr("linen", "rough_linen", 0.3, tint=srgb("#e9dfcb"), tint_mix=0.8)
    canvas = canvas_mat("canvas", "#e6d9bd", 0.35 if LIT else 0.18)
    rope = mat("rope", srgb("#c9b48d"), rough=0.9)
    bark = pbr("bark", "medieval_wood", 0.6, tint=srgb("#5e4630"), tint_mix=0.7, bump=1.2)
    logend = mat("log_end", srgb("#c79e6c"), rough=0.8)
    glaze = mat("glaze_cream", srgb("#efe4cc"), rough=0.2, coat=0.4)
    marigold = mat("glaze_marigold", srgb("#d9932e"), rough=0.25, coat=0.4)
    leaf_g = mat("salad", srgb("#6f9a3c"), rough=0.5)
    dark_glass = mat("dark_glass", srgb("#2f383e"), 0.06)
    soot = mat("soot", srgb("#1b1714"), 0.9)

    # ---- Ground: the lawn, and the cliff top beyond the wall falling away
    ground = mesh_obj("ground", [(-30, -30, GROUND), (60, -30, GROUND), (60, CLIFF_Y + 0.6, GROUND), (-30, CLIFF_Y + 0.6, GROUND)],
                      [(0, 1, 2, 3)], lawn, smooth=False)
    world_origin(ground)
    mesh_obj("cliff_top", [(-30, CLIFF_Y + 0.6, GROUND), (60, CLIFF_Y + 0.6, GROUND), (60, CLIFF_Y + 7, GROUND - 4),
                           (-30, CLIFF_Y + 7, GROUND - 4)], [(0, 1, 2, 3)], lawn, smooth=False)

    # ---- The Inn's garden end: lime-washed stone, the stable door, a gable with its chimney, the slate roof
    gx0, gx1 = 4.5, 4.81                    # 1 cm proud of Flourish's own shell, so the two never fight
    sy0, sy1 = SD_Y - SD_W / 2, SD_Y + SD_W / 2
    cy0, cy1 = CD_Y - CD_W / 2, CD_Y + CD_W / 2
    wall = [box_span("inn_garden_a", gx0, gx1, INN_FRONT, cy0, GROUND, EAVES, lime),
            box_span("inn_garden_b", gx0, gx1, cy1, sy0, GROUND, EAVES, lime),
            box_span("inn_garden_c", gx0, gx1, sy1, INN_SEA, GROUND, EAVES, lime),
            box_span("inn_garden_cd_head", gx0, gx1, cy0, cy1, CD_H, EAVES, lime),
            box_span("inn_garden_cd_foot", gx0, gx1, cy0, cy1, GROUND, 0.0, lime),
            box_span("inn_garden_sd_head", gx0, gx1, sy0, sy1, SD_H, EAVES, lime),
            box_span("inn_garden_sd_foot", gx0, gx1, sy0, sy1, GROUND, 0.0, lime)]
    join("inn_garden_wall", wall)
    # beyond the glazed door: the Chiapothecary, dim, as seen through two lots of glass
    box_span("chia_dim", 3.9, gx0, cy0 - 0.3, cy1 + 0.3, 0, CD_H + 0.3, mat("chia_dim", srgb("#5a4632"), 0.8))
    gable = mesh_obj("inn_gable", [(gx0, INN_FRONT, EAVES), (gx0, INN_SEA, EAVES), (gx0, RIDGE_Y, RIDGE_Z),
                                   (gx1, INN_FRONT, EAVES), (gx1, INN_SEA, EAVES), (gx1, RIDGE_Y, RIDGE_Z)],
                     [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], lime, smooth=False)
    world_origin(gable)
    # the slate roof: two slopes, a little overhang at the verge and the eaves; cream bargeboards
    ov, vx = 0.32, gx1 + 0.22
    pitch = math.atan2(RIDGE_Z - EAVES, RIDGE_Y - INN_FRONT)
    for nm, ye, ye2 in (("lane", INN_FRONT - ov, INN_FRONT), ("sea", INN_SEA + ov, INN_SEA)):
        ze = EAVES - ov * math.tan(pitch) + 0.1
        v = [(INN_BACK, ye, ze), (vx, ye, ze), (vx, RIDGE_Y, RIDGE_Z + 0.12), (INN_BACK, RIDGE_Y, RIDGE_Z + 0.12)]
        r = mesh_obj(f"roof_{nm}", v, [(0, 1, 2, 3)], slate, smooth=False)
        r.modifiers.new("thick", "SOLIDIFY").thickness = 0.12
        bb = rod(f"barge_{nm}", (vx + 0.02, ye, ze - 0.05), (vx + 0.02, RIDGE_Y, RIDGE_Z + 0.07), 0.05, cream, verts=4)
        bb.scale = (1, 0.5, 1)
    box_span("ridge", INN_BACK, vx, RIDGE_Y - 0.12, RIDGE_Y + 0.12, RIDGE_Z + 0.05, RIDGE_Z + 0.25, slate, bevel=0.02)
    # chimney stack on the gable, a little toward the sea, two clay pots
    box_span("chimney", 3.9, gx1 + 0.05, RIDGE_Y + 0.7, RIDGE_Y + 1.6, EAVES + 1.0, RIDGE_Z + 1.5, lime, bevel=0.02)
    box_span("chimney_cap", 3.85, gx1 + 0.1, RIDGE_Y + 0.65, RIDGE_Y + 1.65, RIDGE_Z + 1.5, RIDGE_Z + 1.6, drystone, bevel=0.01)
    pot = mat("chimney_pot", srgb("#a4583a"), 0.7)
    for k, y in enumerate((RIDGE_Y + 0.95, RIDGE_Y + 1.35)):
        lathe(f"chimney_pot_{k}", [(0.13, 0), (0.12, 0.3), (0.09, 0.4), (0.1, 0.45)], pot, (4.35, y, RIDGE_Z + 1.6))
    # first-floor windows and a little attic one, lit at night
    glow = emit("window_glow", srgb("#ffc777"), 2.2 if LIT else 0.0)
    for nm, y, z0, z1, w in (("bed_lane", -2.6, 3.2, 4.45, 0.85), ("bed_sea", 2.3, 3.2, 4.45, 0.85), ("attic", RIDGE_Y, 6.15, 6.95, 0.6)):
        box_span(f"win_{nm}_glass", gx1 - 0.08, gx1 - 0.06, y - w / 2, y + w / 2, z0, z1, dark_glass)
        if LIT:
            box_span(f"win_{nm}_glow", gx1 - 0.25, gx1 - 0.24, y - w / 2, y + w / 2, z0, z1, glow)
        for p, a0, a1, b0, b1 in (("l", y - w / 2 - 0.05, y - w / 2, z0, z1), ("r", y + w / 2, y + w / 2 + 0.05, z0, z1),
                                  ("t", y - w / 2 - 0.05, y + w / 2 + 0.05, z1, z1 + 0.06), ("m", y - w / 2, y + w / 2, (z0 + z1) / 2 - 0.02, (z0 + z1) / 2 + 0.02),
                                  ("v", y - 0.015, y + 0.015, z0, z1)):
            box_span(f"win_{nm}_{p}", gx1 - 0.07, gx1 + 0.02, a0, a1, b0, b1, cream, bevel=0.004)
        box_span(f"win_{nm}_sill", gx1, gx1 + 0.08, y - w / 2 - 0.1, y + w / 2 + 0.1, z0 - 0.07, z0, lime, bevel=0.01)
    # a lantern on an iron bracket between the glasshouse and the stable door, lit at night
    rod("wall_lantern_bracket", (gx1, 2.95, 2.42), (gx1 + 0.24, 2.95, 2.42), 0.012, mat("bracket_iron", srgb("#2a2622"), 0.6, 0.8))
    wl = model("Lantern_01", (gx1 + 0.22, 2.95, 1.9), rot_z=10, scale=1.8)
    if LIT:
        point_light("wall_lantern_light", (gx1 + 0.22, 2.95, 2.12), 22, (1.0, 0.7, 0.4), radius=0.04)
        sphere("wall_lantern_flame", (gx1 + 0.22, 2.95, 2.1), 0.018, emit("wall_lantern_flame", srgb("#ffc070"), 60.0), scale=(1, 1, 1.8))
    hotspot("gd-flourish-door", "Back to Flourish", (gx1 - 0.1, SD_Y, 1.1), kind="door", go="flourish")
    hotspot("gd-glasshouse-door", "The glasshouse", (GH_DX + 1.8, 3.15 + GH_DY, 1.1), kind="door", go="glasshouse")

    # ---- The patio: the flags from the stable door (as Flourish has them) out to the table and the oven, as one piece
    pieces = [box_span("patio_a", 4.8, 9.8, 1.75, 7.6, -0.12, -0.05, flags),
              box_span("patio_b", 4.8, 6.6, 1.68, 1.75, -0.12, -0.05, flags)]
    join("patio", pieces)
    edge = [box_span("kerb_x", 9.8, 9.92, 1.63, 7.72, GROUND - 0.02, -0.04, brick, bevel=0.005),
            box_span("kerb_sea", 4.8, 9.92, 7.6, 7.72, GROUND - 0.02, -0.04, brick, bevel=0.005),
            box_span("kerb_lane", 6.6, 9.92, 1.63, 1.75, GROUND - 0.02, -0.04, brick, bevel=0.005)]
    join("patio_kerb", edge)
    if wet:
        water = mat("puddle", srgb("#2c2621"), rough=0.03, coat=1.0)
        for k in range(7 if wet > 0.7 else 4):
            x, y = rnd.uniform(5.4, 9.4), rnd.uniform(2.0, 7.2)
            if abs(x - 6.3) < 0.6 and abs(y - 5.4) < 0.6:
                continue
            sphere(f"puddle_{k}", (x, y, -0.05), rnd.uniform(0.08, 0.2), water,
                   scale=(rnd.uniform(0.7, 1.4), rnd.uniform(0.5, 1.0), 0.008)).rotation_euler.z = rnd.uniform(0, 3)
    hotspot("gd-bbq", "The barbecue", [o for o in bpy.data.objects if o.name.startswith("app_bbq")], kind="kitchen", appliance="bbq")

    # ---- The long table, a bench on the Inn side, mismatched chairs, a summer lunch laid
    cx, cy = TABLE_C
    tl, tw, th = TABLE_S
    top = box_span("table_top", cx - tl / 2, cx + tl / 2, cy - tw / 2, cy + tw / 2, th - 0.05, th, sage, bevel=0.01)
    world_origin(top)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box_span(f"table_leg_{sx}{sy}", cx + sx * (tl / 2 - 0.12) - 0.04, cx + sx * (tl / 2 - 0.12) + 0.04,
                     cy + sy * (tw / 2 - 0.1) - 0.04, cy + sy * (tw / 2 - 0.1) + 0.04, -0.05, th - 0.05, sage, bevel=0.006)
    box_span("table_rail", cx - tl / 2 + 0.1, cx + tl / 2 - 0.1, cy - 0.03, cy + 0.03, 0.12, 0.18, sage, bevel=0.004)
    by = cy - tw / 2 - 0.35
    box_span("bench_top", cx - 0.95, cx + 0.95, by - 0.16, by + 0.16, 0.42, 0.46, oak, bevel=0.008)
    for sx in (-0.8, 0.8):
        box_span(f"bench_leg_{sx}", cx + sx - 0.03, cx + sx + 0.03, by - 0.13, by + 0.13, -0.05, 0.42, oak, bevel=0.004)
    for k, (x, rz, tint) in enumerate(((cx - 0.6, 4, "#6e4a2b"), (cx + 0.15, -4, "#8d9b80"), (cx + 0.75, 1, "#a07a4e"))):
        c = model("painted_wooden_chair_01", (x, cy + tw / 2 + 0.3, -0.05), rot_z=rz)
        retint(c, tint, lo=0.6, hi=1.2)
    z_on = th
    runner = box_span("table_runner", cx - tl / 2 + 0.1, cx + tl / 2 - 0.1, cy - 0.18, cy + 0.18, z_on, z_on + 0.004, linen)
    for k, x in enumerate((cx - 0.75, cx - 0.1, cx + 0.55)):
        for side in (-1, 1):
            cyl(f"plate_{k}_{side}", (x, cy + side * 0.3, z_on + 0.008), 0.12, 0.014, glaze, bevel=0.006)
    lathe("salad_bowl", [(0.0, 0), (0.08, 0.0), (0.16, 0.05), (0.19, 0.11)], marigold, (cx + 0.25, cy, z_on), thick=0.006)
    for k in range(26):
        a, r = rnd.uniform(0, 6.28), rnd.uniform(0, 0.14)
        sphere(f"salad_leaf_{k}", (cx + 0.25 + r * math.cos(a), cy + r * math.sin(a), z_on + 0.09 + rnd.uniform(0, 0.03)), 0.04,
               leaf_g, scale=(1.3, 0.8, 0.25)).rotation_euler = (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, 3))
    lathe("table_jug", [(0.0, 0), (0.06, 0), (0.075, 0.08), (0.06, 0.17), (0.045, 0.21), (0.055, 0.24)], glaze,
          (cx - 0.45, cy - 0.02, z_on), thick=0.004)
    model("wooden_cutting_board", (cx - 0.85, cy + 0.02, z_on), rot_z=90)
    hotspot("gd-table", "The garden table", [top, runner], kind="submit")

    # ---- String lights: from the Inn's eaves band to two timber posts at the patio's far edge, and between the posts
    posts = [(9.7, 1.95), (9.7, 7.35)]
    for k, (x, y) in enumerate(posts):
        box_span(f"light_post_{k}", x - 0.05, x + 0.05, y - 0.05, y + 0.05, GROUND, 2.95, oak, bevel=0.008)
    hooks = [(gx1 + 0.03, 2.35, 2.7), (gx1 + 0.03, 4.6, 2.7)]
    strands = [(hooks[0], (9.7, 1.95, 2.85)), (hooks[1], (9.7, 7.35, 2.85)), (hooks[0], (9.7, 7.35, 2.85)),
               ((9.7, 1.95, 2.85), (9.7, 7.35, 2.85))]
    wire = mat("wire", srgb("#1d1b19"), 0.5)
    bulb_glass = mat("bulb_glass", (0.95, 0.93, 0.88, 1), rough=0.05, transmission=1.0, ior=1.45)
    filament = emit("filament", srgb("#ffb35a"), 40.0 if LIT else 0.0)
    bulbs = []
    for s, (a, b) in enumerate(strands):
        pts = catenary(a, b, 0.32, 24)
        for i in range(len(pts) - 1):
            rod(f"wire_{s}_{i}", pts[i], pts[i + 1], 0.004, wire, verts=6)
        n = int((Vector(b) - Vector(a)).length / 0.5)
        for i in range(1, n):
            p = catenary(a, b, 0.32, n)[i]
            bulbs.append(sphere(f"bulb_{s}_{i}", (p.x, p.y, p.z - 0.07), 0.032, bulb_glass, scale=(1, 1, 1.25)))
            sphere(f"filament_{s}_{i}", (p.x, p.y, p.z - 0.07), 0.011, filament)
            rod(f"bulb_cap_{s}_{i}", (p.x, p.y, p.z), (p.x, p.y, p.z - 0.035), 0.012, wire, verts=8)
            if LIT and i % 4 == 2:
                point_light(f"bulb_light_{s}_{i}", (p.x, p.y, p.z - 0.12), 6, (1.0, 0.72, 0.42), radius=0.04)
    hotspot("gd-lights", "The string lights", bulbs, kind="ambient")

    # ---- The pizza oven: a lime-rendered clay dome on a dry-stone base, a brick arch, logs stored underneath
    oven = build_pizza_oven(rnd, lime, drystone, brick, soot, oak, bark, logend)
    hotspot("gd-pizza-oven", "The pizza oven", oven, kind="ambient")

    # ---- Herbs by the door: a rosemary bush and clay pots of thyme, sage, chives; the water butt between the doors
    herb = kit("shrub_04", tint=("#6f8466", 0.6, 1.1))
    pots = []
    clay = mat("pot_clay", srgb("#b8673f"), 0.75)
    for k, (x, y, r) in enumerate(((5.12, 4.55, 0.17), (5.38, 4.75, 0.13), (5.1, 4.95, 0.12), (5.3, 2.35, 0.15))):
        pots.append(lathe(f"herb_pot_{k}", [(r * 0.75, 0), (r, r * 1.3), (r * 1.08, r * 1.35), (r * 1.08, r * 1.45)], clay,
                          (x, y, -0.05), thick=0.012))
        cyl(f"herb_soil_{k}", (x, y, r * 1.3 - 0.05), r * 1.0, 0.02, soil, verts=24, bevel=0)
        for j in range(3):
            pots.append(place(herb[0], (x + rnd.uniform(-0.04, 0.04), y + rnd.uniform(-0.04, 0.04), r * 1.3 - 0.05),
                              rnd.uniform(0, 360), size=r * 2.4))
    for j in range(5):
        pots.append(place(herb[0], (5.2 + rnd.uniform(-0.15, 0.15), 6.2 + rnd.uniform(-0.3, 0.3), -0.05), rnd.uniform(0, 360), size=0.6))
    hotspot("gd-herbs", "The herbs", pots, kind="ambient")
    retint(model("Barrel_01", (5.15, 1.98, -0.05), rot_z=20), "#7d5b3b", lo=0.5, hi=1.2)     # the water butt
    model("watering_can_metal_01", (5.55, 2.05, -0.05), rot_z=-30)

    # ---- The kitchen garden beside the glasshouse: four raised beds, a brick path between them, beans up a wigwam
    beds = build_beds(rnd, planks, soil, brick, oak)
    hotspot("gd-beds", "The vegetable beds", beds, kind="ambient")

    # ---- The camp: a stone fire pit, a tripod with the camp oven hung over it, log seats, a bell tent
    camp = build_camp(rnd, canvas, rope, iron, bark, logend, linen, oak, soot)

    # ---- Edges: the dry-stone wall on the cliff, the far wall with a gate, the hedge on the lane side, a tree
    build_walls(rnd, drystone, oak)
    shrubs = kit("shrub_02")
    for k in range(16):
        x = 6.9 + k * 0.68
        place(shrubs[k % len(shrubs)], (x, LANE_Y + rnd.uniform(-0.2, 0.2), GROUND), rnd.uniform(0, 360), rnd.uniform(0.75, 1.0))
    for k in range(9):
        place(shrubs[k % len(shrubs)], (SIDE_X - 0.5 + rnd.uniform(-0.2, 0.2), LANE_Y + 0.8 + k * 0.75, GROUND), rnd.uniform(0, 360),
              rnd.uniform(0.6, 0.85))
    for k, x in enumerate((-1.5, 1.5, 3.4, 10.4, 16.4)):
        place(shrubs[(k + 2) % len(shrubs)], (x, CLIFF_Y - 0.6, GROUND), rnd.uniform(0, 360), rnd.uniform(0.45, 0.6))
    tree = kit("tree_small_02")
    place(tree[0], (15.6, -4.6, GROUND), 40, 1.0)
    ferns = kit("fern_02")
    for k in range(6):
        place(ferns[k % len(ferns)], (GH_DX + 1.95 + rnd.uniform(0, 0.2), -4.3 + k * 0.36, GROUND), rnd.uniform(0, 360), size=0.55)
    build_lawn(rnd, wet)

    # ---- Rain in the air
    if WX["rain"]:
        build_rain(rnd, WX["rain"])

    # ---- The far view: the glasshouse's outside plate on a great curve around the garden, the sea in its middle
    centre, R, span = Vector((9.0, 3.3, 0)), 42.0, math.radians(220)
    iw, ih = 2170, 725
    hgt = R * span * ih / iw
    z0 = EYE - 0.42 * hgt
    mid = math.radians(62)                          # the plate's middle (the open sea): between the garden and the sea
    verts, faces = [], []
    segs = 128
    for i in range(segs + 1):
        th_ = mid + span / 2 - (i / segs) * span
        verts += [(centre.x + R * math.cos(th_), centre.y + R * math.sin(th_), z0), (centre.x + R * math.cos(th_), centre.y + R * math.sin(th_), z0 + hgt)]
    for i in range(segs):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    me = bpy.data.meshes.new("view_far")
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uvl.data[li].uv = ((vi // 2) / segs, vi % 2)
    plate = bpy.data.objects.new("view_far", me)
    scene.collection.objects.link(plate)
    plate.data.materials.append(backdrop_mat("view_far", os.path.join(GH_PACK, PLATES[WX["plate"]]), WX["strength"], WX["sat"],
                                             WX["mul"], WX["haze"]))
    for attr in ("visible_shadow", "visible_diffuse", "visible_volume_scatter"):
        setattr(plate, attr, False)
    hotspot("gd-sea", "The sea", (11.0, 16.0, 1.0), kind="ambient")
    hotspot("gd-to-camp", "To the camp", (STOPS["camp"][0][0], STOPS["camp"][0][1], GROUND + 0.05), kind="stop", stops=["patio"],
            go="camp")
    hotspot("gd-to-patio", "To the patio", (STOPS["patio"][0][0], STOPS["patio"][0][1], GROUND + 0.05), kind="stop", stops=["camp"],
            go="patio")

    light_and_render(scene)
    if ROOM:
        adopt_room_look(scene, fl if ROOM == "flourish" else gh)
        # the room keeps its own walls (Flourish's plaster inside the stable door; the glasshouse's Inn wall, door and shop),
        # so the garden's Inn wall, which sits on them, is hidden
        for name in ("inn_garden_wall", "chia_dim") if ROOM == "glasshouse" else ("inn_garden_wall",):
            bpy.data.objects[name].hide_render = True
    return camp


def build_pizza_oven(rnd, lime, drystone, brick, soot, oak, bark, logend):
    ox, oy = OVEN
    face = math.degrees(math.atan2(STOPS["patio"][0][1] - oy, STOPS["patio"][0][0] - ox))   # the mouth turns to the patio
    parts = []
    # base: two stone cheeks and a back, the log store between them, a hearth slab on top
    parts.append(box_span("oven_cheek_l", -0.75, -0.45, -0.7, 0.7, GROUND, 0.88, drystone, bevel=0.02))
    parts.append(box_span("oven_cheek_r", 0.45, 0.75, -0.7, 0.7, GROUND, 0.88, drystone, bevel=0.02))
    parts.append(box_span("oven_back", -0.45, 0.45, 0.4, 0.7, GROUND, 0.88, drystone, bevel=0.02))
    parts.append(box_span("oven_shelf", -0.45, 0.45, -0.7, 0.7, 0.72, 0.88, drystone, bevel=0.01))
    for k in range(11):
        row, col = divmod(k, 4)
        parts.append(cyl(f"oven_log_{k}", (-0.3 + col * 0.2 + (0.1 if row % 2 else 0), 0.0, 0.0 + row * 0.17), 0.075, 1.05,
                         bark, verts=12, bevel=0.01, rot=(math.radians(90), 0, 0)))
    parts.append(box_span("oven_hearth", -0.82, 0.82, -0.82, 0.78, 0.88, 0.98, lime, bevel=0.02))
    # dome with a tunnel cut for the mouth (toward local -y)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, location=(0, 0.06, 0.98), segments=48, ring_count=24)
    dome = bpy.context.active_object
    dome.name = "oven_dome"
    dome.scale = (1, 1, 0.82)
    bpy.ops.object.shade_smooth()
    dome.data.materials.append(lime)
    # the mouth: a tunnel into the dome, its walls sooty (the cutter's material carries over)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.2, location=(0, -0.3, 1.0), rotation=(math.radians(90), 0, 0))
    cutter = bpy.context.active_object
    cutter.name = "oven_cutter"
    cutter.scale = (1.15, 1.0, 1.0)
    cutter.data.materials.append(soot)
    cutter.hide_render = cutter.hide_viewport = True
    bo = dome.modifiers.new("mouth", "BOOLEAN")
    bo.object, bo.operation, bo.solver = cutter, "DIFFERENCE", "EXACT"
    bo.material_mode = "TRANSFER"
    parts.append(dome)
    # embers at the back of the chamber (glowing at night)
    ember = emit("oven_embers", srgb("#ff6a1f"), 6.0 if LIT else 1.2)
    for k in range(14):
        parts.append(sphere(f"oven_ember_{k}", (rnd.uniform(-0.15, 0.15), rnd.uniform(0.0, 0.25), 0.99), rnd.uniform(0.025, 0.05),
                            ember, scale=(1.4, 1, 0.5)))
    # brick arch around the mouth, a little flue above it
    for k in range(13):
        a = math.pi * k / 12
        x, z = math.cos(a) * 0.27, 0.98 + math.sin(a) * 0.27
        b = box_span(f"oven_arch_{k}", x - 0.045, x + 0.045, -0.62, -0.52, z - 0.06, z + 0.06, brick, bevel=0.006)
        b.rotation_euler.y = -(a - math.pi / 2)
        parts.append(b)
    parts.append(cyl("oven_flue", (0, -0.38, 1.62), 0.075, 0.5, soot, verts=24))
    parts.append(cyl("oven_flue_cap", (0, -0.38, 1.88), 0.1, 0.03, soot, verts=24))
    # the peel leaning on the cheek, a bucket of kindling
    parts.append(rod("oven_peel_handle", (0.82, -0.6, GROUND + 0.6), (0.92, -0.62, 1.95), 0.02, oak))
    parts.append(box_span("oven_peel_blade", 0.74, 0.86, -0.78, -0.48, GROUND + 0.02, GROUND + 0.6, oak, bevel=0.01))
    root = bpy.data.objects.new("pizza_oven", None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.location = (ox, oy, 0)
    root.rotation_euler.z = math.radians(face + 90)          # local -y (the mouth) toward the patio
    cutter.parent = root
    if LIT:
        point_light("oven_glow", (ox + 0.2 * math.cos(math.radians(face)), oy + 0.2 * math.sin(math.radians(face)), 1.05), 18,
                    (1.0, 0.45, 0.15), radius=0.15)
    bpy.context.view_layer.update()
    return parts


def build_beds(rnd, planks, soil, brick, oak):
    beds = []
    kale = kit("fern_02", tint=("#4f6e5c", 0.55, 1.05))      # blue-green cavolo nero
    lettuce = kit("shrub_03", tint=("#8bb14e", 0.6, 1.2))
    beans = kit("shrub_03", tint=("#5d8a3a", 0.55, 1.1))
    layout = [((7.1, 8.4), (-0.3, 1.25), "kale"), ((9.0, 10.3), (-0.3, 1.25), "beans"),
              ((7.1, 8.4), (-3.6, -1.0), "lettuce"), ((9.0, 10.3), (-3.6, -1.0), "kale")]
    for k, ((x0, x1), (y0, y1), crop) in enumerate(layout):
        sides = [box_span(f"bed_{k}_{s}", *ext, GROUND, 0.38, planks, bevel=0.006) for s, ext in
                 (("a", (x0, x1, y0, y0 + 0.05)), ("b", (x0, x1, y1 - 0.05, y1)), ("c", (x0, x0 + 0.05, y0, y1)), ("d", (x1 - 0.05, x1, y0, y1)))]
        beds += sides
        beds.append(box_span(f"bed_{k}_soil", x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, GROUND, 0.33, soil))
        if crop == "beans":
            for w, wy in enumerate((y0 + 0.45, y1 - 0.45)):
                apex = ((x0 + x1) / 2, wy, 1.85)
                for c in range(6):
                    a = 2 * math.pi * c / 6
                    foot = ((x0 + x1) / 2 + 0.38 * math.cos(a), wy + 0.38 * math.sin(a), 0.33)
                    beds.append(rod(f"cane_{k}_{w}_{c}", foot, apex, 0.008, oak, verts=6))
                    for j in range(5):
                        t = 0.15 + 0.17 * j
                        p = Vector(foot).lerp(Vector(apex), t)
                        beds.append(place(beans[(c + j) % len(beans)], tuple(p), rnd.uniform(0, 360), size=0.3))
            continue
        src = kale if crop == "kale" else lettuce
        nx, ny = int((x1 - x0) / 0.34), int((y1 - y0) / 0.34)
        for i in range(nx):
            for j in range(ny):
                x = x0 + 0.2 + i * (x1 - x0 - 0.4) / max(nx - 1, 1)
                y = y0 + 0.2 + j * (y1 - y0 - 0.4) / max(ny - 1, 1)
                s = rnd.uniform(0.36, 0.46) if crop == "kale" else rnd.uniform(0.26, 0.32)
                beds.append(place(src[(i + j) % len(src)], (x, y, 0.33), rnd.uniform(0, 360), size=s))
    # brick paths: between the beds, and from the patio along them; gravel by the glasshouse
    path = [box_span("path_main", 8.4, 9.0, -4.2, 1.7, GROUND, -0.06, brick),
            box_span("path_cross", GH_DX + 1.8, 10.3, -1.0, -0.3, GROUND, -0.06, brick),
            box_span("path_door", GH_DX + 1.8, 7.1, -1.95, -1.0, GROUND, -0.06, brick)]
    join("bed_paths", path)
    model("watering_can_metal_01", (8.7, -0.65, -0.06), rot_z=60)
    model("wicker_basket_01", (8.62, 0.6, -0.06), rot_z=15)
    return beds


def build_camp(rnd, canvas, rope, iron, bark, logend, linen, oak, soot):
    px, py = PIT
    pit = model("stone_fire_pit", (px, py, GROUND), rot_z=10)
    out = {"pit": meshes_of(pit)}
    # the fire: split logs in a teepee over embers; burning in fair weather, cold and wet in rain
    charcoal = mat("charcoal", srgb("#1a1816"), 0.95)
    logs = []
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.3
        foot = (px + 0.36 * math.cos(a), py + 0.36 * math.sin(a), GROUND + 0.1)
        logs.append(rod(f"fire_log_{k}", foot, (px, py, GROUND + 0.55), 0.045, bark if WX["fire"] else charcoal, verts=10))
    ember = emit("pit_embers", srgb("#ff5a14"), 4.0 if WX["fire"] else 0.0)
    for k in range(20):
        a, r = rnd.uniform(0, 6.28), rnd.uniform(0, 0.3)
        logs.append(sphere(f"pit_ember_{k}", (px + r * math.cos(a), py + r * math.sin(a), GROUND + 0.1), rnd.uniform(0.03, 0.06),
                           ember if WX["fire"] else charcoal, scale=(1.3, 1, 0.5)))
    if WX["fire"]:
        flame = emit("flame", srgb("#ffa53a"), 18.0)
        core = emit("flame_core", srgb("#ffe08a"), 30.0)
        for k in range(7):
            a, r = rnd.uniform(0, 6.28), rnd.uniform(0, 0.12)
            h = rnd.uniform(0.35, 0.6)
            bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=rnd.uniform(0.07, 0.11), radius2=0.0, depth=h,
                                            location=(px + r * math.cos(a), py + r * math.sin(a), GROUND + 0.15 + h / 2))
            f = bpy.context.active_object
            f.name = f"flame_{k}"
            f.rotation_euler = (rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), 0)
            f.data.materials.append(core if k < 2 else flame)
            f.visible_shadow = False
            logs.append(f)
        point_light("fire_light", (px, py, GROUND + 0.45), 260 if LIT else 60, (1.0, 0.55, 0.22), radius=0.25)
    out["fire"] = logs
    # tripod, chain and the camp oven: a cast-iron pot with a rimmed lid for coals and a wire bail
    apex = (px, py, 1.55)
    trip = []
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        trip.append(rod(f"tripod_{k}", (px + 0.9 * math.cos(a), py + 0.9 * math.sin(a), GROUND), (apex[0], apex[1], apex[2] + 0.08), 0.014, iron))
    trip.append(rod("tripod_chain", apex, (px, py, 0.98), 0.006, iron, verts=6))
    oz = 0.62
    cast = mat("cast_iron", srgb("#232120"), 0.55, 0.7)
    oven = [lathe("camp_oven_pot", [(0.0, 0.0), (0.15, 0.0), (0.18, 0.03), (0.185, 0.17)], cast, (px, py, oz), segs=48, thick=0.008),
            lathe("camp_oven_lid", [(0.19, 0.0), (0.19, 0.015), (0.17, 0.03), (0.0, 0.035)], cast, (px, py, oz + 0.17), segs=48, cap=False),
            cyl("camp_oven_rim", (px, py, oz + 0.2), 0.19, 0.02, cast, verts=48),
            cyl("camp_oven_knob", (px, py, oz + 0.215), 0.03, 0.03, cast, verts=16)]
    bail = catenary((px - 0.19, py, oz + 0.15), (px + 0.19, py, oz + 0.15), -0.21, 12)
    for i in range(len(bail) - 1):
        oven.append(rod(f"camp_oven_bail_{i}", bail[i], bail[i + 1], 0.005, iron, verts=6))
    oven.append(rod("camp_oven_hook", (px, py, oz + 0.36), (px, py, 0.98), 0.006, iron, verts=6))
    for k in range(3):
        a = 2 * math.pi * k / 3
        oven.append(cyl(f"camp_oven_foot_{k}", (px + 0.11 * math.cos(a), py + 0.11 * math.sin(a), oz - 0.03), 0.015, 0.06, cast, verts=8))
    out["oven"] = oven + trip
    # log seats round the fire and a folding stool
    seats = []
    for k, ang in enumerate((200, 255, 320)):
        a = math.radians(ang)
        x, y = px + 1.45 * math.cos(a), py + 1.45 * math.sin(a)
        seats.append(cyl(f"log_seat_{k}", (x, y, GROUND + 0.21), rnd.uniform(0.18, 0.23), 0.42, bark, verts=24, bevel=0.01))
        seats.append(cyl(f"log_seat_top_{k}", (x, y, GROUND + 0.425), 0.17, 0.01, logend, verts=24, bevel=0))
    model("folding_wooden_stool", (px + 1.2, py + 0.9, GROUND), rot_z=30)
    # the bell tent, its door toward the fire
    tx, ty = TENT
    door_az = math.atan2(py - ty, px - tx)
    out["tent"] = build_tent(tx, ty, door_az, canvas, rope, oak, linen)
    hotspot("gd-tent", "The tent", out["tent"], kind="ambient", stops=["camp", "patio"])
    hotspot("gd-camp-oven", "The camp oven", oven, kind="kitchen", stops=["camp", "patio"])
    hotspot("gd-fire-pit", "The fire", out["pit"] + logs[:6], kind="ambient", stops=["camp", "patio"])
    return out


def build_tent(tx, ty, door_az, canvas, rope, oak, linen):
    """A cotton bell tent, 3.8 m across: a short wall, a cone to the pole, the door flaps rolled and tied back."""
    R, wall_h, apex_h = 1.9, 0.62, 2.95
    prof = [(R, GROUND), (R, wall_h), (R * 0.93, wall_h + 0.12)]
    for k in range(1, 15):
        t = k / 14
        prof.append((R * 0.93 * (1 - t) + 0.07 * t, wall_h + 0.12 + (apex_h - wall_h - 0.12) * (t ** 0.92)))
    segs = 96
    verts, faces = [], []
    for r, z in prof:
        for i in range(segs):
            a = 2 * math.pi * i / segs
            verts.append((tx + r * math.cos(a + door_az), ty + r * math.sin(a + door_az), z))

    def door_half(z):                                     # the door's half-width (m) at height z
        return 0.0 if z > 1.85 else 0.5 - 0.3 * max(0.0, z - GROUND) / 1.95

    for k in range(len(prof) - 1):
        for i in range(segs):
            a0 = 2 * math.pi * (i + 0.5) / segs
            a0 = a0 - 2 * math.pi if a0 > math.pi else a0
            zc, rc = (prof[k][1] + prof[k + 1][1]) / 2, (prof[k][0] + prof[k + 1][0]) / 2
            if not WX["shut"] and abs(a0) * rc < door_half(zc):
                continue
            faces.append((k * segs + i, k * segs + (i + 1) % segs, (k + 1) * segs + (i + 1) % segs, (k + 1) * segs + i))
    tent = mesh_obj("tent_canvas", verts, faces, canvas)
    tent.modifiers.new("thick", "SOLIDIFY").thickness = 0.006
    parts = [tent]
    parts.append(cyl("tent_pole", (tx, ty, (GROUND + apex_h + 0.12) / 2), 0.03, apex_h + 0.12 - GROUND, oak, verts=12))
    parts.append(cyl("tent_floor", (tx, ty, GROUND + 0.01), R - 0.02, 0.02, pbr("groundsheet", "rough_linen", 0.4, tint=srgb("#6b6650"), tint_mix=0.8), verts=64))
    rug = pbr("rug", "knitted_fleece", 0.3, tint=srgb("#a2462f"), tint_mix=0.6)
    parts.append(cyl("tent_rug", (tx + 0.25 * math.cos(door_az), ty + 0.25 * math.sin(door_az), GROUND + 0.03), 0.9, 0.02, rug, verts=48))
    fleece = pbr("fleece", "knitted_fleece", 0.2, tint=srgb("#efe7d6"), tint_mix=0.7)
    for k, (dx, dy) in enumerate(((-0.6, 0.7), (-0.9, -0.3), (-0.4, -0.85))):
        c, s = math.cos(door_az), math.sin(door_az)
        parts.append(sphere(f"tent_cushion_{k}", (tx + dx * c - dy * s, ty + dx * s + dy * c, GROUND + 0.12), 0.32, fleece if k else linen,
                            scale=(1.2, 0.9, 0.35)))
    if WX["shut"]:
        # laced shut for the storm: the door seam and its ties
        c, s = math.cos(door_az), math.sin(door_az)
        parts.append(rod("tent_seam", (tx + R * c * 1.004, ty + R * s * 1.004, GROUND), (tx + R * 0.9 * c, ty + R * 0.9 * s, 1.85), 0.008, rope))
    else:
        # the flaps rolled to either side of the door, tied with rope
        for side in (-1, 1):
            pts = []
            for k in range(9):
                z = GROUND + 0.05 + k * 0.22
                r = R if z <= wall_h else R * 0.93 - (z - wall_h - 0.12) * (R * 0.93 - 0.07) / (apex_h - wall_h - 0.12)
                a = door_az + side * (door_half(z) + 0.05) / max(r, 0.3)
                pts.append((tx + (r + 0.05) * math.cos(a), ty + (r + 0.05) * math.sin(a), z))
            for k in range(len(pts) - 1):
                parts.append(rod(f"tent_flap_{side}_{k}", pts[k], pts[k + 1], 0.055, canvas, verts=14))
            for z_i in (2, 6):
                parts.append(sphere(f"tent_tie_{side}_{z_i}", pts[z_i], 0.065, rope, scale=(1, 1, 0.3)))
    # guy lines from the wall top to pegs
    for k in range(10):
        a = door_az + math.radians(18 + k * 32.4)
        top = (tx + R * math.cos(a), ty + R * math.sin(a), wall_h)
        peg = (tx + 3.0 * math.cos(a), ty + 3.0 * math.sin(a), GROUND + 0.08)
        parts.append(rod(f"tent_guy_{k}", top, peg, 0.004, rope, verts=5))
        parts.append(box_span(f"tent_peg_{k}", peg[0] - 0.015, peg[0] + 0.015, peg[1] - 0.015, peg[1] + 0.015, GROUND, GROUND + 0.1, oak))
    # the lantern on a crate just inside the door: lit at night
    lx, ly = tx + 0.9 * math.cos(door_az + 0.5), ty + 0.9 * math.sin(door_az + 0.5)
    parts.append(box_span("tent_crate", lx - 0.18, lx + 0.18, ly - 0.14, ly + 0.14, GROUND, GROUND + 0.32, oak, bevel=0.01))
    lan = model("Lantern_01", (lx, ly, GROUND + 0.32), rot_z=20, scale=1.4)
    if LIT:
        point_light("tent_lantern", (lx, ly, GROUND + 0.52), 35, (1.0, 0.68, 0.36), radius=0.05)
        sphere("tent_lantern_flame", (lx, ly, GROUND + 0.5), 0.015, emit("lantern_flame", srgb("#ffc070"), 60.0), scale=(1, 1, 1.8))
    parts += meshes_of(lan)
    return parts


def build_walls(rnd, drystone, oak):
    """Dry-stone walls: a coursed body with a row of upright coping stones along the top."""
    def wall(name, a, b, h=0.95, t=0.5):
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        ang = math.atan2(d.y, d.x)
        body = box_span(f"{name}_body", 0, L, -t / 2, t / 2, GROUND, GROUND + h, drystone, bevel=0.04)
        body.matrix_world = (Matrix.Translation((a.x, a.y, body.location.z)) @ Matrix.Rotation(ang, 4, "Z")
                             @ Matrix.Translation((L / 2, 0, 0)))
        stones = [body]
        n = int(L / 0.16)
        for i in range(n):
            u = (i + 0.5) / n * L
            p = a + d.normalized() * u
            s = box_span(f"{name}_cope_{i}", -0.05, 0.05, -t / 2 + 0.04, t / 2 - 0.04, 0, rnd.uniform(0.18, 0.26), drystone, bevel=0.02)
            s.matrix_world = (Matrix.Translation((p.x, p.y, GROUND + h - 0.02)) @ Matrix.Rotation(ang + rnd.uniform(-0.06, 0.06), 4, "Z")
                              @ Matrix.Rotation(rnd.uniform(-0.15, 0.15), 4, "Y"))
            stones.append(s)
        join(name, stones)

    wall("wall_cliff", (-12, CLIFF_Y), (SIDE_X + 0.25, CLIFF_Y))
    wall("wall_side_sea", (SIDE_X, CLIFF_Y), (SIDE_X, 1.9))
    wall("wall_side_lane", (SIDE_X, 0.7), (SIDE_X, LANE_Y))
    wall("wall_lane", (GH_DX + 1.95, LANE_Y), (SIDE_X, LANE_Y), h=0.6)
    # the gate to the headland path, shut
    for k, y in enumerate((1.9, 0.7)):
        box_span(f"gate_post_{k}", SIDE_X - 0.09, SIDE_X + 0.09, y - 0.09, y + 0.09, GROUND, 1.25, oak, bevel=0.01)
    for z in (0.25, 0.6, 0.95):
        box_span(f"gate_rail_{z}", SIDE_X - 0.025, SIDE_X + 0.025, 0.8, 1.8, z, z + 0.08, oak, bevel=0.005)
    for k in range(6):
        y = 0.85 + k * 0.18
        box_span(f"gate_pale_{k}", SIDE_X - 0.02, SIDE_X + 0.02, y - 0.035, y + 0.035, 0.15, 1.05, oak, bevel=0.004)


def lawn_blocked(x, y):
    """Where no grass grows: the flags, the beds and paths, the glasshouse, the fire pit, the tent, the oven, the walls."""
    if 4.7 < x < 9.95 and 1.6 < y < 7.75:
        return True
    if GH_DX + 1.75 < x < 10.4 and -4.3 < y < 1.7:
        return True
    if x < GH_DX + 1.85 and y < 1.7:
        return True
    for c, r in ((PIT, 0.8), (TENT, 1.92), (OVEN, 0.95)):
        if (Vector((x, y)) - Vector(c)).length < r:
            return True
    return y > CLIFF_Y - 0.27 or y < LANE_Y + 0.27 or x > SIDE_X - 0.27 or x < 4.83


def build_lawn(rnd, wet):
    """Hair grass over the open lawn (thickest near the two stops), with a scatter of taller tufts."""
    step = 0.25
    nx, ny = int((SIDE_X - 4.8) / step), int((CLIFF_Y - LANE_Y) / step)
    verts, faces, ids = [], [], {}

    def vid(i, j):
        if (i, j) not in ids:
            ids[(i, j)] = len(verts)
            verts.append((4.8 + i * step, LANE_Y + j * step, GROUND + 0.002))
        return ids[(i, j)]
    for i in range(nx):
        for j in range(ny):
            if not lawn_blocked(4.8 + (i + 0.5) * step, LANE_Y + (j + 0.5) * step):
                faces.append((vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)))
    base = mesh_obj("lawn_hair", verts, faces, None, smooth=False)
    vg = base.vertex_groups.new(name="density")
    cams = [Vector(c[:2]) for c, _ in STOPS.values()]
    for k, v in enumerate(verts):
        d = min((Vector(v[:2]) - c).length for c in cams)
        vg.add([k], max(0.22, min(1.0, 1.25 - d / 7)), "REPLACE")
    hm = bpy.data.materials.new("lawn_blades")
    hm.use_nodes = True
    nt = hm.node_tree
    p = nt.nodes["Principled BSDF"]
    info = nt.nodes.new("ShaderNodeHairInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    root_c, tip_c = {"very-dry": ("#6b6a2c", "#c9b86e")}.get(WEATHER, ("#2f4a1c", "#86a84a"))
    ramp.color_ramp.elements[0].color = srgb(root_c)
    ramp.color_ramp.elements[1].color = srgb(tip_c)
    nt.links.new(info.outputs["Intercept"], ramp.inputs["Fac"])
    var = nt.nodes.new("ShaderNodeMix")
    var.data_type, var.blend_type = "RGBA", "MULTIPLY"
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value, rr.inputs["To Max"].default_value = 0.7, 1.15
    nt.links.new(info.outputs["Random"], rr.inputs["Value"])
    var.inputs["Factor"].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], var.inputs[6])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    for ax in ("X", "Y", "Z"):
        nt.links.new(rr.outputs["Result"], comb.inputs[ax])
    nt.links.new(comb.outputs[0], var.inputs[7])
    nt.links.new(var.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.55 - 0.35 * wet
    p.inputs["Specular IOR Level"].default_value = 0.35 + 0.4 * wet
    base.data.materials.append(hm)
    mod = base.modifiers.new("grass", "PARTICLE_SYSTEM")
    ps = mod.particle_system
    ps.vertex_group_density = "density"
    st = ps.settings
    st.type = "HAIR"
    st.count = 40000 if QUICK else 160000
    st.hair_length = 0.085 if WEATHER != "very-dry" else 0.06
    st.child_type = "INTERPOLATED"
    st.rendered_child_count = 4 if QUICK else 8
    st.child_length = 0.75
    st.child_length_threshold = 0.4
    st.roughness_1 = 0.01
    st.roughness_2 = 0.03
    st.roughness_endpoint = 0.035
    st.root_radius, st.tip_radius, st.radius_scale = 1.0, 0.0, 0.0025
    st.render_step = 3
    st.material_slot = "lawn_blades"
    base.show_instancer_for_render = False
    base.show_instancer_for_viewport = False
    # a scatter of taller tufts, mostly near the walls and the beds
    grass = kit("grass_medium_01", keep=["LOD0"], tint=("#b4a25e", 0.6, 1.1) if WEATHER == "very-dry" else None)
    n = 0
    for _ in range(4000):
        x, y = rnd.uniform(4.8, SIDE_X), rnd.uniform(LANE_Y, CLIFF_Y)
        if lawn_blocked(x, y):
            continue
        near_edge = min(abs(y - CLIFF_Y), abs(y - LANE_Y), abs(x - SIDE_X), abs(x - 10.5) + abs(y + 1.3) * 0.2) < 0.9
        if not near_edge and rnd.random() > 0.15:
            continue
        place(grass[n % len(grass)], (x, y, GROUND), rnd.uniform(0, 360), rnd.uniform(0.6, 1.0))
        n += 1
        if n >= 500:
            break
    print(f"[whisked] lawn: {len(faces)} cells, {n} tufts")


def indoors(p):
    """Inside Flourish's room or the glasshouse (--room): no rain falls there."""
    in_flourish = p.x < 4.8 and 0 <= p.y <= 4.8 and p.z < 2.8
    in_glasshouse = GH_DX <= p.x <= GH_DX + 1.9 and GH_DY <= p.y <= GH_DY + 6.4 and p.z < 3.2
    return in_flourish or in_glasshouse


def build_rain(rnd, heavy):
    """Rain: thin streaks facing the camera, falling a little slanted, thick near the camera and out to ~16 m."""
    n = 7000 if heavy == 1 else 13000
    length, slant = (0.32, 0.12) if heavy == 1 else (0.48, 0.35)
    wind = Vector((0.6, -0.35, 0)).normalized()
    verts, faces = [], []
    for k in range(n):
        cam = Vector(list(STOPS.values())[k % 2][0])          # half round each stop, so either stop sees the same rain
        r = 0.7 + (rnd.random() ** 1.6) * 15.5
        a = rnd.uniform(0, 2 * math.pi)
        p = cam + Vector((r * math.cos(a), r * math.sin(a), rnd.uniform(-1.6, 4.5)))
        if p.z < GROUND or (ROOM and indoors(p)):
            continue
        d = (Vector((0, 0, -1)) + wind * slant).normalized() * length * rnd.uniform(0.7, 1.2)
        w = 0.0009 + 0.0005 * r / 8
        for axis in (Vector((1, 0, 0)), Vector((0, 1, 0))):   # two crossed ribbons: a streak from any side
            side = d.cross(axis).normalized() * w
            i = len(verts)
            verts += [tuple(p - side), tuple(p + side), tuple(p + d + side), tuple(p + d - side)]
            faces.append((i, i + 1, i + 2, i + 3))
    m = bpy.data.materials.new("rain")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (0.82, 0.86, 0.9, 1)
    e.inputs["Strength"].default_value = 0.04 if NIGHT else 0.6 * WX["sky"]
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.18
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(e.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    o = mesh_obj("rain_streaks", verts, faces, m, smooth=False)
    for attr in ("visible_shadow", "visible_diffuse", "visible_glossy"):
        setattr(o, attr, False)


def hdri_sun_azimuth(img):
    """Where the HDRI's sun is (degrees from +X toward +Y, as Blender maps an equirectangular world)."""
    import numpy as np
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    lum = px.reshape(h, w, 4)[:, :, :3].sum(axis=2)
    row, col = np.unravel_index(int(np.argmax(lum)), lum.shape)
    u = (col + 0.5) / w
    return math.degrees((0.5 - u) * 2 * math.pi)


def light_and_render(scene):
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    tc = wnt.nodes.new("ShaderNodeTexCoord")
    mp = wnt.nodes.new("ShaderNodeMapping")
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", WX["hdri"] + ".hdr"), check_existing=True)
    if WX["hdri"] != OVERCAST and not NIGHT:
        rot = hdri_sun_azimuth(env.image) - WX["sun_az"]
        mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot))
    wnt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    wnt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    tint = wnt.nodes.new("ShaderNodeMix")
    tint.data_type, tint.blend_type = "RGBA", "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = (0.55, 0.62, 1.0, 1) if NIGHT else (1, 1, 1, 1)
    wnt.links.new(env.outputs["Color"], tint.inputs[6])
    wnt.links.new(tint.outputs[2], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = WX["sky"]
    if NIGHT:
        # a little moonlight from over the sea, so the garden has shape
        moon = bpy.data.lights.new("moon", "SUN")
        moon.energy, moon.color, moon.angle = 0.12, (0.62, 0.7, 1.0), math.radians(1.0)
        mo = bpy.data.objects.new("moon", moon)
        e, a = math.radians(35), math.radians(120)
        mo.rotation_euler = Vector((-math.cos(e) * math.cos(a), -math.cos(e) * math.sin(a), -math.sin(e))).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(mo)

    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = 32 if QUICK else 128 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transparent_max_bounces = 24
    scene.render.resolution_x = 1024 if QUICK else 2048 if PREVIEW else 8192
    scene.render.resolution_y = scene.render.resolution_x // 2
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = WX["exposure"]
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def adopt_room_look(scene, path):
    """--room: the room's own sky, sun lamp and colour settings, as its build left them (the garden's outdoor look stays)."""
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.worlds, dst.scenes = list(src.worlds), list(src.scenes)
    world = next(w for w in dst.worlds if w is not None)
    src_scene = dst.scenes[0]
    scene.world = world
    scene.view_settings.exposure = src_scene.view_settings.exposure
    scene.view_settings.look = src_scene.view_settings.look
    scene.cycles.max_bounces = src_scene.cycles.max_bounces
    bpy.data.scenes.remove(src_scene)


# ---------------------------------------------------------------- hotspots and render

def visible_from(cam, hs):
    deps = bpy.context.evaluated_depsgraph_get()
    origin = Vector(cam)
    target = Vector(hs["center"])
    d = target - origin
    dist = d.length
    ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(deps, origin, d.normalized(), distance=dist)
    if not ok or (obj and (obj.name in hs["objects"] or obj.name.startswith(("glass", "roof_glass", "view_", "rain_", "bulb_")))):
        return True
    return (loc - origin).length > dist - 0.25


def stop_hotspots(stop):
    cam, yaw0 = STOPS[stop]
    out = {}
    for key, hs in HOTSPOTS.items():
        if hs["stops"] and stop not in hs["stops"]:
            continue
        yaw, pitch = look(cam, hs["center"], cam[2])
        yaw = round((yaw - yaw0 + 540) % 360 - 180, 2)
        out[key] = {"label": hs["label"], "type": hs["type"], "overlay": hs["overlay"], "yaw": yaw, "pitch": pitch,
                    "distance": round((Vector(hs["center"]) - Vector(cam)).length, 2), "visible": visible_from(cam, hs)}
        for extra in ("appliance", "go"):
            if hs.get(extra):
                out[key][extra] = hs[extra]
    return out


def render_room(scene):
    """--room: a panorama from the room's own camera, saved under the room's own file name."""
    if NO_RENDER:
        return
    sizes = [("", 8192, 384), ("_preview", 2048, 128)] if BOTH else [("_quick" if QUICK else "_preview" if PREVIEW else "",
                                                                      scene.render.resolution_x, scene.cycles.samples)]
    pano_camera(scene, *ROOM_CAMS[ROOM])
    stem = "flourish_pano" if ROOM == "flourish" else f"glasshouse_pano_{SEASON}"
    for suffix, res, samples in sizes:
        scene.render.resolution_x, scene.render.resolution_y, scene.cycles.samples = res, res // 2, samples
        scene.render.filepath = os.path.join(OUT, f"{stem}_{WEATHER}{'_night' if NIGHT else ''}{suffix}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"[whisked] rendered {ROOM} {WEATHER}{' night' if NIGHT else ''}{suffix}")
    print("[whisked] done")


def main():
    build()
    scene = bpy.context.scene
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "garden.blend"))
    if ROOM:
        render_room(scene)
        return
    data = {"room": "garden", "stops": {s: {"position": list(STOPS[s][0]), "yaw": STOPS[s][1], "hotspots": stop_hotspots(s)}
                                        for s in STOPS}}
    with open(os.path.join(OUT, "garden_hotspots.json"), "w") as fh:
        json.dump(data, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)")
        return
    sizes = [("", 8192, 384), ("_preview", 2048, 128)] if BOTH else         [("_quick" if QUICK else "_preview" if PREVIEW else "", scene.render.resolution_x, scene.cycles.samples)]
    for stop in (STOPS if STOP == "all" else [STOP]):
        pano_camera(scene, *STOPS[stop])
        for suffix, res, samples in sizes:
            scene.render.resolution_x, scene.render.resolution_y, scene.cycles.samples = res, res // 2, samples
            scene.render.filepath = os.path.join(OUT, f"garden_pano_{stop}_{WEATHER}{'_night' if NIGHT else ''}{suffix}.jpg")
            bpy.ops.render.render(write_still=True)
            print(f"[whisked] rendered {stop} {WEATHER}{' night' if NIGHT else ''}{suffix}")
    print("[whisked] done")


main()
