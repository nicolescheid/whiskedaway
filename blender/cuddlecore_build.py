"""
Cuddlecore Kitchen: builds the room, renders a 360 equirectangular panorama with Cycles,
and writes hotspot angles (yaw/pitch) for the browser viewer.

Needs the CC0 Poly Haven assets first:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/cuddlecore_build.py -- [--preview] [--no-render]

Room axes: X = left/right, Y = forward (front wall = +Y), Z = up. Metres.
The camera stands in the middle of the room at eye height, looking at the front wall.
Poly Haven models import facing -Y, so rotate_z turns them to face into the room:
front wall 0, left wall +90, right wall -90, back wall 180.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS   # rebuild .blend + hotspots only

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

W, D, H = 4.5, 4.5, 2.7          # room width, depth, height
HX, HY = W / 2, D / 2
EYE = 1.6


# ---------------------------------------------------------------- helpers

def srgb(hex_str):
    h = hex_str.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def principled(m):
    m.use_nodes = True
    return m.node_tree, m.node_tree.nodes["Principled BSDF"]


def mat(name, color, rough=0.6, metal=0.0, transmission=0.0, ior=1.45,
        emission=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    _, p = principled(m)
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["IOR"].default_value = ior
    p.inputs["Coat Weight"].default_value = coat
    if emission:
        p.inputs["Emission Color"].default_value = emission
        p.inputs["Emission Strength"].default_value = strength
    return m


def pbr(name, tex_id, size_m=2.0, tint=None, tint_mix=0.0, rough_add=0.0, bump=0.6, rot_z=0.0):
    """Scanned Poly Haven material, box-projected in object space so it keeps real-world scale."""
    folder = os.path.join(ASSETS, "textures", tex_id)
    m = bpy.data.materials.new(name)
    nt, p = principled(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size_m,) * 3
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot_z))
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def tex(kind, non_color):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(os.path.join(folder, f"{kind}.jpg"), check_existing=True)
        if non_color:
            t.image.colorspace_settings.name = "Non-Color"
        t.projection = "BOX"
        t.projection_blend = 0.25
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t

    diff = tex("diff", False)
    col = diff.outputs["Color"]
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        # tint_mix >= 1: multiply; 0..1: paint over with a flat colour, keeping the scan's relief
        mix.blend_type = "MULTIPLY" if tint_mix >= 1 else "MIX"
        mix.inputs["Factor"].default_value = min(tint_mix, 1.0)
        nt.links.new(col, mix.inputs[6])
        mix.inputs[7].default_value = tint
        col = mix.outputs[2]
    ao = tex("ao", True)
    aomix = nt.nodes.new("ShaderNodeMix")
    aomix.data_type = "RGBA"
    aomix.blend_type = "MULTIPLY"
    aomix.inputs["Factor"].default_value = 0.6
    nt.links.new(col, aomix.inputs[6])
    nt.links.new(ao.outputs["Color"], aomix.inputs[7])
    nt.links.new(aomix.outputs[2], p.inputs["Base Color"])

    rough = tex("rough", True)
    if rough_add:
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        add.use_clamp = True
        add.inputs[1].default_value = rough_add
        nt.links.new(rough.outputs["Color"], add.inputs[0])
        nt.links.new(add.outputs[0], p.inputs["Roughness"])
    else:
        nt.links.new(rough.outputs["Color"], p.inputs["Roughness"])

    nor = tex("nor", True)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = bump
    nt.links.new(nor.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    return m


def finish(o, material, bevel):
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    if material:
        o.data.materials.append(material)
    return o


def box(name, loc, size, material, bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, bevel)


def cyl(name, loc, r, h, material, verts=48, bevel=0.004, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    return finish(o, material, bevel)


def model(aid, loc, rot_z=0.0, scale=1.0):
    """Import a Poly Haven glTF, parent it to an empty, and place it. Returns the empty."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "models", aid, f"{aid}.gltf"))
    new = [o for o in bpy.context.scene.objects if o not in before]
    root = bpy.data.objects.new(aid, None)
    bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(rot_z))
    root.scale = (scale,) * 3
    bpy.context.view_layer.update()
    return root


def meshes_of(root):
    return [o for o in root.children_recursive if o.type == "MESH"]


def bbox_center(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return [(min(p[i] for p in pts) + max(p[i] for p in pts)) / 2 for i in range(3)]


def point_light(name, loc, watts, color, radius=0.02):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = watts
    data.color = color
    data.shadow_soft_size = radius
    o = bpy.data.objects.new(name, data)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    return o


def area_light(name, loc, rot, size, watts, color, portal=False):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.energy = watts
    data.color = color
    if portal:
        data.cycles.is_portal = True
    o = bpy.data.objects.new(name, data)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    return o


# Hero objects get recorded so the viewer can place hotspots exactly.
HOTSPOTS = {}


def hotspot(key, label, overlay, target, kind="interactive"):
    bpy.context.view_layer.update()
    if isinstance(target, (list, tuple)) and target and hasattr(target[0], "bound_box"):
        c = bbox_center(target)
    elif hasattr(target, "bound_box"):
        c = bbox_center(meshes_of(target) or [target])
    else:
        c = target
    dx, dy, dz = c[0], c[1], c[2] - EYE
    yaw = math.degrees(math.atan2(dx, dy))                    # 0 = front wall, + = to the right
    pitch = math.degrees(math.atan2(dz, math.hypot(dx, dy)))  # + = up
    HOTSPOTS[key] = {"label": label, "overlay": overlay, "type": kind,
                     "yaw": round(yaw, 2), "pitch": round(pitch, 2)}


def shelf_heights(root, x, y, top):
    """Ray-cast down through a shelf unit to find the shelf surfaces."""
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    hits, z = [], top
    while z > 0.05:
        ok, loc, *_rest = bpy.context.scene.ray_cast(deps, Vector((x, y, z)), Vector((0, 0, -1)))
        if not ok:
            break
        hits.append(loc.z)
        z = loc.z - 0.03
    return hits


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # Scanned materials
    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#eadcc4"), tint_mix=0.85, bump=0.6)
    floor = pbr("floor", "old_wooden_floor_01", 2.5, bump=0.8)
    beam_wood = pbr("beams", "wood_table_worn", 1.5, tint=srgb("#8a6448"), tint_mix=1.0, rot_z=90)
    worktop = pbr("worktop", "wood_table_worn", 1.2)
    dark_wood = pbr("dark_wood", "medieval_wood", 2.2, tint=srgb("#9a7a60"), tint_mix=1.0)
    berry_linen = pbr("berry_linen", "rough_linen", 0.6, tint=srgb("#8b4d5c"), tint_mix=1.0, bump=0.5)
    berry_knit = pbr("berry_knit", "knitted_fleece", 0.4, tint=srgb("#a85a6c"), tint_mix=1.0, bump=1.0)
    rug_mat = pbr("rug", "knitted_fleece", 0.5, tint=srgb("#c79a92"), tint_mix=0.8, bump=1.0)

    # Simple materials
    enamel = mat("enamel", srgb("#e9dcc3"), rough=0.22, coat=0.7)
    cast_iron = mat("cast_iron", srgb("#191716"), rough=0.6, metal=0.8)
    brass = mat("brass", srgb("#b58a45"), rough=0.32, metal=1.0)
    beeswax = mat("beeswax", srgb("#f0ddb2"), rough=0.45)
    beeswax.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.6
    flame = mat("flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.55, 0.2, 1), strength=30)
    paper = mat("paper", srgb("#e3d1ab"), rough=0.9)
    cork = mat("cork", srgb("#a8845a"), rough=0.9)
    berry_glaze = mat("berry_glaze", srgb("#8b4d5c"), rough=0.18, coat=0.5)
    glass = mat("glass", (0.96, 0.98, 0.97, 1), rough=0.03, transmission=1.0, ior=1.5)
    fills = [srgb(c) for c in ("#c9a25b", "#7a8a4a", "#e9d9b4", "#b5651d", "#d8b04a")]
    book_colours = ["#6e3b3b", "#3f5543", "#8b6b3e", "#2f3e4f", "#7d4a5a", "#a08155", "#4d3a2a", "#c2a878"]

    # Rain-streaked window glass: stretched noise drives a bump
    rain_glass = mat("rain_glass", (0.97, 0.99, 1.0, 1), rough=0.05, transmission=1.0, ior=1.5)
    nt = rain_glass.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (60, 60, 6)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.5
    nz.inputs["Detail"].default_value = 2
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.6
    ramp.color_ramp.elements[1].position = 0.7
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.4
    nt.links.new(ramp.outputs["Color"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])

    # ---- Shell
    box("floor", (0, 0, -0.05), (W, D, 0.1), floor, bevel=0)
    box("ceiling", (0, 0, H + 0.05), (W, D, 0.1), plaster, bevel=0)
    box("wall_left", (-HX - 0.05, 0, H / 2), (0.1, D, H), plaster, bevel=0)
    box("wall_right", (HX + 0.05, 0, H / 2), (0.1, D, H), plaster, bevel=0)
    box("wall_back", (0, -HY - 0.05, H / 2), (W, 0.1, H), plaster, bevel=0)
    win_l, win_r, win_b, win_t = -0.65, 0.65, 1.15, 2.15
    box("wall_front_l", ((-HX + win_l) / 2, HY + 0.15, H / 2), (win_l + HX, 0.3, H), plaster, bevel=0)
    box("wall_front_r", ((HX + win_r) / 2, HY + 0.15, H / 2), (HX - win_r, 0.3, H), plaster, bevel=0)
    box("wall_front_b", (0, HY + 0.15, win_b / 2), (win_r - win_l, 0.3, win_b), plaster, bevel=0)
    box("wall_front_t", (0, HY + 0.15, (H + win_t) / 2), (win_r - win_l, 0.3, H - win_t), plaster, bevel=0)

    for x in (-1.5, 0, 1.5):
        box(f"beam_{x}", (x, 0, H - 0.1), (0.2, D, 0.2), beam_wood, bevel=0.015)
    box("beam_cross", (0, HY - 0.1, H - 0.1), (W, 0.2, 0.2), beam_wood, bevel=0.015)
    for name, loc, size in (("skirt_l", (-HX + 0.01, 0, 0.08), (0.02, D, 0.16)),
                            ("skirt_r", (HX - 0.01, 0, 0.08), (0.02, D, 0.16)),
                            ("skirt_b", (0, -HY + 0.01, 0.08), (W, 0.02, 0.16)),
                            ("skirt_f", (0, HY - 0.01, 0.08), (W, 0.02, 0.16))):
        box(name, loc, size, dark_wood, bevel=0.003)

    # ---- Front wall: deep-set window, curtains, range + pot, map
    box("sill", (0, HY - 0.04, win_b - 0.025), (1.5, 0.3, 0.05), worktop, bevel=0.006)
    box("frame_v", (0, HY + 0.2, (win_b + win_t) / 2), (0.04, 0.05, win_t - win_b), worktop)
    box("frame_h", (0, HY + 0.2, (win_b + win_t) / 2), (win_r - win_l, 0.05, 0.04), worktop)
    for side, x in (("l", win_l + 0.02), ("r", win_r - 0.02)):
        box(f"frame_{side}", (x, HY + 0.2, (win_b + win_t) / 2), (0.05, 0.07, win_t - win_b), worktop)
    box("frame_t", (0, HY + 0.2, win_t - 0.02), (win_r - win_l, 0.07, 0.05), worktop)
    box("frame_b", (0, HY + 0.2, win_b + 0.02), (win_r - win_l, 0.07, 0.05), worktop)
    pane = box("glass", (0, HY + 0.21, (win_b + win_t) / 2), (win_r - win_l, 0.006, win_t - win_b), rain_glass, bevel=0)
    hotspot("window", "The rain", None, pane, kind="ambient")

    for side, x in (("l", win_l - 0.2), ("r", win_r + 0.2)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, HY - 0.1, (win_b + win_t) / 2 + 0.08),
                                         rotation=(math.radians(90), 0, 0))
        c = bpy.context.active_object
        c.name = f"curtain_{side}"
        c.scale = (0.45, 1.35, 1)
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.subdivide(number_cuts=48)
        bpy.ops.object.mode_set(mode="OBJECT")
        tex = bpy.data.textures.new(f"folds_{side}", "WOOD")
        tex.wood_type = "BANDS"
        tex.noise_basis_2 = "SIN"
        tex.turbulence = 1.5
        tex.noise_scale = 0.12
        disp = c.modifiers.new("folds", "DISPLACE")
        disp.texture = tex
        disp.texture_coords = "LOCAL"
        disp.strength = 0.045
        disp.direction = "Z"
        c.modifiers.new("thick", "SOLIDIFY").thickness = 0.005
        bpy.ops.object.shade_smooth()
        c.data.materials.append(berry_linen)
    box("curtain_rod", (0, HY - 0.1, win_t + 0.16), (2.1, 0.025, 0.025), brass, bevel=0.01)

    box("range", (0, HY - 0.33, 0.43), (0.95, 0.62, 0.86), enamel, bevel=0.03)
    box("range_top", (0, HY - 0.33, 0.875), (0.97, 0.64, 0.03), cast_iron, bevel=0.006)
    box("range_door", (0, HY - 0.645, 0.38), (0.62, 0.02, 0.42), enamel, bevel=0.015)
    box("range_handle", (0, HY - 0.675, 0.64), (0.52, 0.025, 0.025), brass, bevel=0.01)
    for x in (-0.22, 0.22):
        cyl(f"hob_{x}", (x, HY - 0.33, 0.894), 0.13, 0.012, cast_iron, bevel=0.003)
    pot = model("pot_enamel_01", (0.02, HY - 0.33, 0.9), rot_z=10, scale=1.7)
    # Steam: a soft volume above the pot
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(0.02, HY - 0.36, 1.42))
    steam = bpy.context.active_object
    steam.name = "steam"
    steam.scale = (0.9, 0.9, 1.6)
    sm = bpy.data.materials.new("steam")
    snt, sp = principled(sm)
    snt.nodes.remove(sp)
    vol = snt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (1, 0.97, 0.94, 1)
    stc = snt.nodes.new("ShaderNodeTexCoord")
    snz = snt.nodes.new("ShaderNodeTexNoise")
    snz.inputs["Scale"].default_value = 3.5
    snz.inputs["Detail"].default_value = 6
    snt.links.new(stc.outputs["Object"], snz.inputs["Vector"])
    # Fade out towards the edge of the sphere and upward
    grad = snt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    snt.links.new(stc.outputs["Object"], grad.inputs["Vector"])
    mul = snt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    snt.links.new(snz.outputs["Fac"], mul.inputs[0])
    snt.links.new(grad.outputs["Fac"], mul.inputs[1])
    dens = snt.nodes.new("ShaderNodeMapRange")
    dens.inputs["From Min"].default_value = 0.15
    dens.inputs["To Max"].default_value = 6.0
    snt.links.new(mul.outputs[0], dens.inputs["Value"])
    snt.links.new(dens.outputs["Result"], vol.inputs["Density"])
    snt.links.new(vol.outputs["Volume"], snt.nodes["Material Output"].inputs["Volume"])
    steam.data.materials.append(sm)
    hotspot("cauldron", "Find Comfort", None, pot, kind="submit")

    m = box("map", (1.4, HY - 0.003, 1.62), (0.36, 0.004, 0.27), paper, bevel=0)
    box("map_pin", (1.4, HY - 0.008, 1.74), (0.012, 0.01, 0.012), brass, bevel=0)
    hotspot("locale-map", "Location", "locale", m)
    plant = model("potted_plant_02", (-1.45, HY - 0.45, 0), rot_z=20, scale=1.0)
    hotspot("plant", "The plant", None, plant, kind="ambient")

    # ---- Left wall: counter, jar shelf, candles, cutting board
    box("counter_base", (-HX + 0.32, 0.1, 0.43), (0.62, 1.9, 0.86), dark_wood, bevel=0.01)
    box("counter_top", (-HX + 0.33, 0.1, 0.885), (0.68, 1.96, 0.05), worktop, bevel=0.008)
    shelf = box("jar_shelf", (-HX + 0.14, 0.3, 1.6), (0.28, 1.5, 0.04), worktop, bevel=0.006)
    for y in (-0.35, 0.95):
        box(f"bracket_{y}", (-HX + 0.07, y, 1.52), (0.13, 0.035, 0.14), dark_wood, bevel=0.004)
    jars = []
    for i, (y, h) in enumerate(zip([-0.3, -0.03, 0.25, 0.52, 0.78], [0.24, 0.18, 0.28, 0.2, 0.22])):
        r = 0.065 if i % 2 else 0.075
        z0 = 1.62
        if i in (1, 3):
            jars.append(cyl(f"jar_{i}", (-HX + 0.14, y, z0 + h / 2), r, h, berry_glaze))
        else:
            jars.append(cyl(f"jar_{i}", (-HX + 0.14, y, z0 + h / 2), r, h, glass, bevel=0.01))
            fill = mat(f"fill_{i}", fills[i], rough=0.9)
            cyl(f"jar_fill_{i}", (-HX + 0.14, y, z0 + h * 0.36), r * 0.9, h * 0.68, fill, bevel=0)
        cyl(f"lid_{i}", (-HX + 0.14, y, z0 + h + 0.015), r * 0.86, 0.03, cork)
    hotspot("symptom-jars", "How you're feeling", "symptoms", jars + [shelf])

    candle_objs = []
    for i, (y, h) in enumerate(zip((-0.62, -0.48, -0.34), (0.1, 0.17, 0.25))):
        x = -HX + 0.36
        stick = model("wooden_candlestick", (x, y, 0.91), scale=0.8)
        top = 0.91 + 0.22 * 0.8
        candle_objs += meshes_of(stick)
        candle_objs.append(cyl(f"candle_{i}", (x, y, top + h / 2), 0.022, h, beeswax, bevel=0.005))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.009, location=(x, y, top + h + 0.02))
        f = bpy.context.active_object
        f.scale = (1, 1, 2.3)
        f.data.materials.append(flame)
        point_light(f"candle_light_{i}", (x + 0.02, y, top + h + 0.035), 4, (1.0, 0.55, 0.22), radius=0.012)
    hotspot("energy-candles", "Energy level", "energy", candle_objs)
    board = model("wooden_cutting_board", (-HX + 0.38, 0.45, 0.91), rot_z=95)
    hotspot("cutting-board", "Chopping board", None, board, kind="ambient")
    model("wooden_spoon", (-HX + 0.4, 0.15, 0.93), rot_z=70)
    bowl = model("wooden_bowl_01", (-HX + 0.34, 0.85, 0.91))
    hotspot("bowl", "The bowl", None, bowl, kind="ambient")

    # ---- Right wall: painted cabinet (pantry) with an oil lamp, worn bookshelf of cookbooks
    pantry = model("painted_wooden_cabinet", (HX - 0.34, 0.85, 0), rot_z=-90)
    basket = model("wicker_basket_01", (HX - 0.32, 1.15, 1.18), rot_z=-80)
    hotspot("basket", "The basket", None, basket, kind="ambient")
    model("ceramic_vase_01", (HX - 0.3, 0.45, 1.18), scale=0.7)
    lamp = model("vintage_oil_lamp", (HX - 0.3, 0.75, 1.18), scale=0.65)
    for o in meshes_of(lamp):
        if o.name.endswith("flame"):
            o.data.materials.clear()
            o.data.materials.append(flame)
    point_light("lamp_light", (HX - 0.3, 0.75, 1.18 + 0.35), 18, (1.0, 0.62, 0.3), radius=0.03)
    hotspot("oil-lamp", "The lamp", None, lamp, kind="ambient")
    hotspot("pantry-cabinet", "Your pantry", "pantry", pantry)

    shelf_x, shelf_y = HX - 0.3, -0.9
    bs = model("wooden_bookshelf_worn", (shelf_x, shelf_y, 0), rot_z=-90)
    hits = shelf_heights(bs, shelf_x - 0.05, shelf_y, 2.2)
    shelves = sorted(z for z in hits if 0.1 < z < max(hits) - 0.15)  # skip the floor and the top board
    for zi, z in enumerate(shelves):
        y = shelf_y - 0.6
        bi = 0
        while y < shelf_y + 0.55:
            t = 0.025 + ((bi * 7 + zi) % 5) * 0.008
            hb = 0.2 + ((bi * 3 + zi) % 5) * 0.03
            lean = math.radians(8) if (bi + zi) % 11 == 10 else 0
            colour = mat(f"book_{zi}_{bi}", srgb(book_colours[(bi * 3 + zi) % len(book_colours)]), rough=0.75)
            b = box(f"book_{zi}_{bi}", (shelf_x - 0.06, y + t / 2, z + hb / 2), (0.19, t, hb), colour, bevel=0.003)
            b.rotation_euler = (lean, 0, 0)
            y += t + 0.004
            bi += 1
    hotspot("dietary-shelf", "Dietary needs", "dietary", bs)

    # ---- Back wall: door, armchair + blanket, rug
    door = box("door", (-1.1, -HY + 0.03, 1.0), (0.85, 0.05, 2.0), dark_wood, bevel=0.012)
    for z in (0.5, 1.5):
        box(f"door_panel_{z}", (-1.1, -HY + 0.06, z), (0.62, 0.015, 0.75), dark_wood, bevel=0.01)
    box("door_frame_t", (-1.1, -HY + 0.04, 2.04), (1.0, 0.09, 0.09), beam_wood, bevel=0.008)
    for x in (-1.57, -0.63):
        box(f"door_frame_{x}", (x, -HY + 0.04, 1.02), (0.09, 0.09, 2.08), beam_wood, bevel=0.008)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(-0.78, -HY + 0.09, 1.0))
    bpy.context.active_object.data.materials.append(brass)
    hotspot("exit-door", "Back to the inn", None, door, kind="door")

    chair = model("ArmChair_01", (0.75, -HY + 0.55, 0), rot_z=165)
    hotspot("armchair", "The armchair", None, chair, kind="ambient")
    throw = box("throw", (0.75, -HY + 0.6, 0.5), (0.42, 0.36, 0.07), berry_knit, bevel=0.03)
    throw.rotation_euler = (math.radians(3), math.radians(-4), math.radians(-12))
    cyl("rug", (0.2, -0.45, 0.006), 0.95, 0.012, rug_mat, verts=128, bevel=0.004)

    # ---- Lighting: overcast sky through the window, warm interior
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "kloofendal_overcast_puresky.hdr"))
    wmap = wnt.nodes.new("ShaderNodeMapping")
    wmap.inputs["Rotation"].default_value = (0, 0, math.radians(30))
    wtc = wnt.nodes.new("ShaderNodeTexCoord")
    wnt.links.new(wtc.outputs["Generated"], wmap.inputs["Vector"])
    wnt.links.new(wmap.outputs["Vector"], env.inputs["Vector"])
    wnt.links.new(env.outputs["Color"], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = 1.2

    area_light("window_portal", (0, HY + 0.2, (win_b + win_t) / 2), (math.radians(90), 0, 0),
               (win_r - win_l, win_t - win_b), 0, (1, 1, 1), portal=True)
    area_light("window_bounce", (0, HY - 0.05, (win_b + win_t) / 2), (math.radians(90), 0, 0),
               (1.3, 1.0), 120, (0.8, 0.88, 1.0))
    point_light("warm_fill", (0.3, -0.4, 2.3), 70, (1.0, 0.74, 0.48), radius=0.8)

    # ---- Camera: 360 equirectangular from the middle of the room
    cam_data = bpy.data.cameras.new("pano")
    cam_data.type = "PANO"
    cam_data.panorama_type = "EQUIRECTANGULAR"
    cam = bpy.data.objects.new("pano", cam_data)
    cam.location = (0, 0, EYE)
    cam.rotation_euler = (math.radians(90), 0, 0)  # look at +Y (front wall)
    scene.collection.objects.link(cam)
    scene.camera = cam

    # ---- Render settings
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == backend]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == backend
                scene.cycles.device = "GPU"
                print(f"[whisked] rendering on {backend}: {[d.name for d in gpus]}")
                break
        except TypeError:
            continue
    scene.cycles.samples = 128 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 10
    scene.cycles.volume_bounces = 1
    scene.cycles.volume_step_rate = 2.0
    scene.render.resolution_x = 2048 if PREVIEW else 8192
    scene.render.resolution_y = 1024 if PREVIEW else 4096
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 1.25
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def main():
    build()
    suffix = "_preview" if PREVIEW else ""
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "cuddlecore.blend"))
    with open(os.path.join(OUT, "cuddlecore_hotspots.json"), "w") as fh:
        json.dump(HOTSPOTS, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)", json.dumps(HOTSPOTS))
        return
    bpy.context.scene.render.filepath = os.path.join(OUT, f"cuddlecore_pano{suffix}.jpg")
    bpy.ops.render.render(write_still=True)
    print("[whisked] done", json.dumps(HOTSPOTS))


main()
