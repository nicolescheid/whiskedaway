"""
Cuddlecore Kitchen: builds the room, renders a 360 equirectangular panorama with Cycles,
and writes hotspot angles (yaw/pitch) for the browser viewer.

Run headless:
  blender -b --factory-startup --python blender/cuddlecore_build.py -- [--preview]

Room axes: X = left/right, Y = forward (front wall = +Y), Z = up. Metres.
The camera stands in the middle of the room at eye height, looking at the front wall.
"""
import bpy
import json
import math
import os
import sys

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

W, D, H = 4.5, 4.5, 2.7          # room width, depth, height
HX, HY = W / 2, D / 2
EYE = 1.6
BERRY = (0.258, 0.074, 0.098)    # #8b4d5c in linear-ish space


# ---------------------------------------------------------------- helpers

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hex_str):
    h = hex_str.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def mat(name, color, rough=0.6, metal=0.0, transmission=0.0, ior=1.45,
        emission=None, strength=0.0, bump=None, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color if len(color) == 4 else (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["IOR"].default_value = ior
    p.inputs["Coat Weight"].default_value = coat
    if emission:
        p.inputs["Emission Color"].default_value = (*emission[:3], 1)
        p.inputs["Emission Strength"].default_value = strength
    if bump:
        scale, strength_b, detail = bump
        tc = nt.nodes.new("ShaderNodeTexCoord")
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = strength_b
        nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
        nt.links.new(n.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
        # Subtle colour variation driven by the same noise
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        base = p.inputs["Base Color"].default_value[:]
        ramp.color_ramp.elements[0].color = tuple(c * 0.85 for c in base[:3]) + (1,)
        ramp.color_ramp.elements[1].color = tuple(min(1, c * 1.08) for c in base[:3]) + (1,)
        nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    return m


def wood_mat(name, light, dark, planks=False, rough=0.55):
    """Procedural wood: stretched noise grain, optional plank seams."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = rough
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 14.0, 1.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    grain = nt.nodes.new("ShaderNodeTexWave")
    grain.wave_type = "BANDS"
    grain.inputs["Scale"].default_value = 3.0
    grain.inputs["Distortion"].default_value = 9.0
    grain.inputs["Detail"].default_value = 6.0
    nt.links.new(mp.outputs["Vector"], grain.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = srgb(dark)
    ramp.color_ramp.elements[1].color = srgb(light)
    nt.links.new(grain.outputs["Fac"], ramp.inputs["Fac"])
    color_out = ramp.outputs["Color"]
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(grain.outputs["Fac"], bump.inputs["Height"])
    if planks:
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Mortar Size"].default_value = 0.004
        brick.inputs["Brick Width"].default_value = 1.6
        brick.inputs["Row Height"].default_value = 0.18
        brick.inputs["Color1"].default_value = (1, 1, 1, 1)
        brick.inputs["Color2"].default_value = (0.82, 0.82, 0.82, 1)
        brick.inputs["Mortar"].default_value = (0.05, 0.05, 0.05, 1)
        nt.links.new(tc.outputs["Object"], brick.inputs["Vector"])
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(ramp.outputs["Color"], mul.inputs[6])
        nt.links.new(brick.outputs["Color"], mul.inputs[7])
        color_out = mul.outputs[2]
        seams = nt.nodes.new("ShaderNodeMath")
        seams.operation = "ADD"
        nt.links.new(grain.outputs["Fac"], seams.inputs[0])
        nt.links.new(brick.outputs["Fac"], seams.inputs[1])
        nt.links.new(seams.outputs[0], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = 0.25
    nt.links.new(color_out, p.inputs["Base Color"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def box(name, loc, size, material, bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    o.data.materials.append(material)
    return o


def cyl(name, loc, r, h, material, verts=48, bevel=0.004, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def point_light(name, loc, watts, kelvin_rgb, radius=0.02):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = watts
    data.color = kelvin_rgb
    data.shadow_soft_size = radius
    o = bpy.data.objects.new(name, data)
    o.location = loc
    bpy.context.collection.objects.link(o)
    return o


def area_light(name, loc, rot, size, watts, color):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.energy = watts
    data.color = color
    o = bpy.data.objects.new(name, data)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.collection.objects.link(o)
    return o


# Hero objects get recorded so the viewer can place hotspots exactly.
HOTSPOTS = {}


def hotspot(key, label, overlay, obj_or_point, kind="interactive"):
    if hasattr(obj_or_point, "matrix_world"):
        bpy.context.view_layer.update()
        pts = [obj_or_point.matrix_world @ v.co for v in obj_or_point.data.vertices]
        c = [sum(p[i] for p in pts) / len(pts) for i in range(3)]
    else:
        c = obj_or_point
    dx, dy, dz = c[0], c[1], c[2] - EYE
    yaw = math.degrees(math.atan2(dx, dy))                 # 0 = front wall, + = to the right
    pitch = math.degrees(math.atan2(dz, math.hypot(dx, dy)))  # + = up
    HOTSPOTS[key] = {"label": label, "overlay": overlay, "type": kind,
                     "yaw": round(yaw, 2), "pitch": round(pitch, 2)}


# ---------------------------------------------------------------- build

def build():
    reset()
    scene = bpy.context.scene

    plaster = mat("plaster", srgb("#efe6d6"), rough=0.92, bump=(18, 0.12, 8))
    ceiling_plaster = mat("ceiling", srgb("#e9dfcd"), rough=0.95, bump=(12, 0.08, 6))
    floor = wood_mat("floor", "#8a6646", "#4e3523", planks=True, rough=0.5)
    oak = wood_mat("oak", "#a07a52", "#6a4a2e", rough=0.5)
    dark_oak = wood_mat("dark_oak", "#5a3e28", "#2e1f14", rough=0.6)
    beam_wood = wood_mat("beams", "#6b4c33", "#3a281b", rough=0.75)
    painted = mat("pantry_paint", srgb("#8f9a86"), rough=0.55, bump=(40, 0.04, 4))
    door_paint = mat("door_paint", srgb("#6f4a3a"), rough=0.5, bump=(40, 0.03, 4))
    enamel = mat("enamel", srgb("#e8dcc4"), rough=0.25, coat=0.6)
    cast_iron = mat("cast_iron", srgb("#1c1a19"), rough=0.55, metal=0.85, bump=(120, 0.15, 4))
    brass = mat("brass", srgb("#b58a45"), rough=0.3, metal=1.0)
    glass = mat("glass", (0.95, 0.97, 0.96, 1), rough=0.02, transmission=1.0, ior=1.5)
    berry_linen = mat("berry_linen", srgb("#8b4d5c"), rough=0.85, bump=(200, 0.08, 2))
    berry_wool = mat("berry_wool", srgb("#7d3f4f"), rough=0.95, bump=(90, 0.35, 3))
    cream_wool = mat("cream_wool", srgb("#e6dccb"), rough=0.95, bump=(90, 0.3, 3))
    berry_glaze = mat("berry_glaze", srgb("#8b4d5c"), rough=0.2, coat=0.4)
    beeswax = mat("beeswax", srgb("#efdcb0"), rough=0.4)
    paper = mat("paper", srgb("#e7d6b2"), rough=0.9)
    rug = mat("rug", srgb("#a46a6f"), rough=0.98, bump=(60, 0.4, 3))
    flame = mat("flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.55, 0.2), strength=25)
    outside = mat("outside", srgb("#8fa3a8"), emission=srgb("#a9bcc2"), strength=2.2)
    cork = mat("cork", srgb("#a8845a"), rough=0.9)
    fills = [srgb(c) for c in ("#c9a25b", "#7a8a4a", "#e9d9b4", "#b5651d", "#d8b04a", "#8a5a3a")]
    book_colours = ["#6e3b3b", "#3f5543", "#8b6b3e", "#2f3e4f", "#7d4a5a", "#a08155", "#4d3a2a"]

    # Shell: floor, ceiling, walls (front wall split around the window)
    box("floor", (0, 0, -0.05), (W, D, 0.1), floor, bevel=0)
    box("ceiling", (0, 0, H + 0.05), (W, D, 0.1), ceiling_plaster, bevel=0)
    box("wall_left", (-HX - 0.05, 0, H / 2), (0.1, D, H), plaster, bevel=0)
    box("wall_right", (HX + 0.05, 0, H / 2), (0.1, D, H), plaster, bevel=0)
    box("wall_back", (0, -HY - 0.05, H / 2), (W, 0.1, H), plaster, bevel=0)
    win_l, win_r, win_b, win_t = -0.65, 0.65, 1.15, 2.15
    box("wall_front_l", ((-HX + win_l) / 2, HY + 0.05, H / 2), (win_l + HX, 0.1, H), plaster, bevel=0)
    box("wall_front_r", ((HX + win_r) / 2, HY + 0.05, H / 2), (HX - win_r, 0.1, H), plaster, bevel=0)
    box("wall_front_b", (0, HY + 0.05, win_b / 2), (win_r - win_l, 0.1, win_b), plaster, bevel=0)
    box("wall_front_t", (0, HY + 0.05, (H + win_t) / 2), (win_r - win_l, 0.1, H - win_t), plaster, bevel=0)

    # Ceiling beams and skirting
    for x in (-1.5, 0, 1.5):
        box(f"beam_{x}", (x, 0, H - 0.09), (0.18, D, 0.18), beam_wood, bevel=0.012)
    for name, loc, size in (("skirt_l", (-HX + 0.01, 0, 0.07), (0.02, D, 0.14)),
                            ("skirt_r", (HX - 0.01, 0, 0.07), (0.02, D, 0.14)),
                            ("skirt_b", (0, -HY + 0.01, 0.07), (W, 0.02, 0.14))):
        box(name, loc, size, dark_oak, bevel=0.003)

    # ---- Front wall: window, curtains, range + pot, map
    box("sill", (0, HY - 0.06, win_b - 0.02), (1.5, 0.2, 0.05), oak)
    box("frame_v", (0, HY + 0.02, (win_b + win_t) / 2), (0.05, 0.06, win_t - win_b), oak)
    box("frame_h", (0, HY + 0.02, (win_b + win_t) / 2), (win_r - win_l, 0.06, 0.05), oak)
    for side, x in (("l", win_l), ("r", win_r)):
        box(f"frame_{side}", (x, HY + 0.02, (win_b + win_t) / 2), (0.06, 0.08, win_t - win_b + 0.06), oak)
    box("frame_t", (0, HY + 0.02, win_t), (win_r - win_l + 0.06, 0.08, 0.06), oak)
    box("glass", (0, HY + 0.03, (win_b + win_t) / 2), (win_r - win_l, 0.006, win_t - win_b), glass, bevel=0)
    box("outside", (0, HY + 1.5, 1.6), (6, 0.05, 4), outside, bevel=0)

    for side, x in (("l", win_l - 0.22), ("r", win_r + 0.22)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, HY - 0.08, (win_b + win_t) / 2 + 0.05),
                                         rotation=(math.radians(90), 0, 0))
        c = bpy.context.active_object
        c.name = f"curtain_{side}"
        c.scale = (0.42, 1.25, 1)
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.subdivide(number_cuts=40)
        bpy.ops.object.mode_set(mode="OBJECT")
        tex = bpy.data.textures.new(f"folds_{side}", "WOOD")
        tex.wood_type = "BANDS"
        tex.noise_basis_2 = "SIN"
        tex.turbulence = 1.2
        disp = c.modifiers.new("folds", "DISPLACE")
        disp.texture = tex
        disp.strength = 0.05
        disp.direction = "Z"
        sol = c.modifiers.new("thick", "SOLIDIFY")
        sol.thickness = 0.006
        bpy.ops.object.shade_smooth()
        c.data.materials.append(berry_linen)
    box("curtain_rod", (0, HY - 0.08, win_t + 0.14), (2.0, 0.025, 0.025), brass, bevel=0.008)

    rng = box("range", (0, HY - 0.36, 0.43), (0.95, 0.62, 0.86), enamel, bevel=0.03)
    box("range_top", (0, HY - 0.36, 0.875), (0.97, 0.64, 0.03), cast_iron, bevel=0.006)
    box("range_door", (0, HY - 0.67, 0.38), (0.6, 0.02, 0.4), enamel, bevel=0.015)
    box("range_handle", (0, HY - 0.70, 0.62), (0.5, 0.025, 0.025), brass, bevel=0.01)
    pot = cyl("pot", (0, HY - 0.38, 1.02), 0.2, 0.26, cast_iron, bevel=0.03)
    cyl("pot_lid", (0, HY - 0.38, 1.16), 0.205, 0.025, cast_iron, bevel=0.01)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(0, HY - 0.38, 1.19))
    bpy.context.active_object.data.materials.append(brass)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.04, minor_radius=0.012,
                                         location=(sx * 0.23, HY - 0.38, 1.1),
                                         rotation=(math.radians(90), 0, 0))
        bpy.context.active_object.data.materials.append(cast_iron)
    hotspot("cauldron", "Find Comfort", None, pot, kind="submit")

    m = box("map", (1.45, HY - 0.006, 1.62), (0.34, 0.006, 0.26), paper, bevel=0)
    hotspot("locale-map", "Location", "locale", m)

    # ---- Left wall: counter, jar shelf, candles
    box("counter_base", (-HX + 0.32, 0.1, 0.43), (0.62, 1.9, 0.86), dark_oak, bevel=0.01)
    box("counter_top", (-HX + 0.33, 0.1, 0.885), (0.66, 1.96, 0.05), oak, bevel=0.008)
    shelf = box("jar_shelf", (-HX + 0.13, 0.25, 1.58), (0.26, 1.5, 0.035), oak, bevel=0.006)
    for y in (-0.4, 0.9):
        box(f"bracket_{y}", (-HX + 0.06, y, 1.5), (0.12, 0.03, 0.14), dark_oak, bevel=0.004)
    jar_ys = [-0.35, -0.08, 0.2, 0.47, 0.72]
    jar_hs = [0.24, 0.18, 0.28, 0.2, 0.22]
    for i, (y, h) in enumerate(zip(jar_ys, jar_hs)):
        r = 0.065 if i % 2 else 0.075
        base_z = 1.598
        if i in (1, 3):
            cyl(f"jar_{i}", (-HX + 0.13, y, base_z + h / 2), r, h, berry_glaze)
        else:
            cyl(f"jar_{i}", (-HX + 0.13, y, base_z + h / 2), r, h, glass, bevel=0.01)
            fill = mat(f"fill_{i}", fills[i], rough=0.9, bump=(150, 0.5, 3))
            cyl(f"jar_fill_{i}", (-HX + 0.13, y, base_z + h * 0.35), r * 0.9, h * 0.66, fill, bevel=0)
        cyl(f"lid_{i}", (-HX + 0.13, y, base_z + h + 0.015), r * 0.85, 0.03, cork)
    hotspot("symptom-jars", "How you're feeling", "symptoms", shelf)

    candle_group = []
    for i, (y, h) in enumerate(zip((-0.55, -0.42, -0.29), (0.12, 0.2, 0.28))):
        x = -HX + 0.32
        cyl(f"candle_{i}", (x, y, 0.91 + h / 2), 0.035, h, beeswax, bevel=0.006)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=(x, y, 0.91 + h + 0.025))
        f = bpy.context.active_object
        f.scale = (1, 1, 2.2)
        f.data.materials.append(flame)
        point_light(f"candle_light_{i}", (x, y, 0.91 + h + 0.04), 6, (1.0, 0.58, 0.25), radius=0.015)
        candle_group.append((x, y, 0.91 + h / 2 + 0.05))
    cx = sum(p[0] for p in candle_group) / 3
    cy = sum(p[1] for p in candle_group) / 3
    cz = sum(p[2] for p in candle_group) / 3
    hotspot("energy-candles", "Energy level", "energy", (cx, cy, cz))

    # ---- Right wall: pantry cupboard, cookbook shelf
    pantry = box("pantry", (HX - 0.3, 0.75, 1.05), (0.58, 1.1, 2.1), painted, bevel=0.015)
    box("pantry_door_l", (HX - 0.6, 0.48, 1.05), (0.02, 0.52, 1.9), painted, bevel=0.01)
    door_r = box("pantry_door_r", (HX - 0.85, 1.12, 1.05), (0.52, 0.02, 1.9), painted, bevel=0.01)
    door_r.rotation_euler = (0, 0, math.radians(-25))
    for z, name in ((0.55, "knob_a"), (1.05, "knob_b")):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(HX - 0.62, 0.95, z + 0.4))
        bpy.context.active_object.data.materials.append(brass)
    point_light("pantry_glow", (HX - 0.3, 1.0, 1.4), 8, (1.0, 0.75, 0.45), radius=0.1)
    hotspot("pantry-cabinet", "Your pantry", "pantry", pantry)

    bs = box("bookshelf", (HX - 0.15, -0.75, 0.7), (0.3, 0.9, 1.4), oak, bevel=0.008)
    for zi, z in enumerate((0.42, 0.85, 1.27)):
        y = -1.15
        for bi in range(9):
            t = 0.03 + (bi * 7 % 5) * 0.008
            hb = 0.2 + ((bi + zi) * 3 % 5) * 0.025
            colour = mat(f"book_{zi}_{bi}", srgb(book_colours[(bi + zi) % len(book_colours)]), rough=0.7)
            box(f"book_{zi}_{bi}", (HX - 0.32, y + t / 2, z + hb / 2), (0.2, t, hb), colour, bevel=0.003)
            y += t + 0.006
            if y > -0.38:
                break
    hotspot("dietary-shelf", "Dietary needs", "dietary", bs)

    # ---- Back wall: door, armchair + blanket, rug
    door = box("door", (-1.1, -HY + 0.03, 1.0), (0.85, 0.05, 2.0), door_paint, bevel=0.012)
    box("door_frame_t", (-1.1, -HY + 0.03, 2.04), (1.0, 0.08, 0.08), dark_oak, bevel=0.006)
    for x in (-1.57, -0.63):
        box(f"door_frame_{x}", (x, -HY + 0.03, 1.02), (0.08, 0.08, 2.08), dark_oak, bevel=0.006)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(-0.78, -HY + 0.08, 1.0))
    bpy.context.active_object.data.materials.append(brass)
    hotspot("exit-door", "Back to the inn", None, door, kind="door")

    box("chair_seat", (0.9, -1.65, 0.3), (0.85, 0.75, 0.3), berry_wool, bevel=0.08)
    box("chair_back", (0.9, -1.98, 0.68), (0.85, 0.18, 0.75), berry_wool, bevel=0.08)
    for sx in (-1, 1):
        box(f"chair_arm_{sx}", (0.9 + sx * 0.4, -1.68, 0.52), (0.16, 0.78, 0.25), berry_wool, bevel=0.06)
    blanket = box("blanket", (0.95, -1.62, 0.5), (0.7, 0.55, 0.06), cream_wool, bevel=0.03)
    blanket.rotation_euler = (math.radians(4), math.radians(-6), math.radians(8))
    cyl("rug", (0.2, -0.3, 0.004), 1.15, 0.008, rug, verts=96, bevel=0)

    # ---- Lighting
    area_light("window_light", (0, HY + 0.3, 1.65), (math.radians(90), 0, 0), (1.3, 1.0), 260, (0.78, 0.87, 1.0))
    point_light("warm_fill", (0.4, -0.2, 2.35), 40, (1.0, 0.72, 0.45), radius=0.5)

    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.02, 0.025, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.2

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
    scene.cycles.samples = 64 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.render.resolution_x = 2048 if PREVIEW else 6144
    scene.render.resolution_y = 1024 if PREVIEW else 3072
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.6
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88


def main():
    build()
    suffix = "_preview" if PREVIEW else ""
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "cuddlecore.blend"))
    with open(os.path.join(OUT, "cuddlecore_hotspots.json"), "w") as fh:
        json.dump(HOTSPOTS, fh, indent=2)
    bpy.context.scene.render.filepath = os.path.join(OUT, f"cuddlecore_pano{suffix}.jpg")
    bpy.ops.render.render(write_still=True)
    print("[whisked] done", json.dumps(HOTSPOTS))


main()
