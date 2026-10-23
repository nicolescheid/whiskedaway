"""
Teaching tools and a little table for the Inn's kitchens (technique cards). Same style as appliances.py: cream enamel,
brass, honey wood; built in local metres and parented to an empty. Shared by flourish_build.py and cuddlecore_build.py.

Wall pieces use a wall frame: local X along the wall, local Y out from the wall into the room, local Z up, origin at the
hook or peg. Put them on a wall with rot_z: 0 = a wall facing +Y (the front wall at y=0), -90 = a wall facing +X (the
hallway wall in Flourish and the left wall in Cuddlecore), 90 = facing -X, 180 = facing -Y.
Standing pieces have their base centred on the origin, front facing local +Y.
"""
import bpy
import math

from appliances import _group, _lathe, _rod
from whisked import box, cyl, mat, sphere, srgb

_Y = (-math.pi / 2, 0, 0)       # turns a lathe/cylinder's Z axis to point out of the wall (+Y)


def tool_mats():
    return {
        "enamel": mat("tool_enamel", srgb("#ece3cf"), rough=0.3, coat=0.6),
        "brass": mat("tool_brass", srgb("#bd9655"), rough=0.3, metal=1.0),
        "iron": mat("tool_iron", srgb("#2a2622"), rough=0.6, metal=0.8),
        "wood": mat("tool_wood", srgb("#b98b57"), rough=0.55),
        "walnut": mat("tool_walnut", srgb("#6b4128"), rough=0.5),
        "dark": mat("tool_dark", srgb("#1d1f1f"), rough=0.2, coat=0.3),
        "red": mat("tool_red", srgb("#a8402f"), rough=0.35, coat=0.5),
        "porcelain": mat("tool_porcelain", srgb("#f3eee3"), rough=0.2, coat=0.6),
        "glass": mat("tool_glass", (0.96, 0.98, 0.97, 1), rough=0.03, transmission=1.0, ior=1.5),
        "water": mat("tool_water", (0.9, 0.96, 1.0, 1), rough=0.02, transmission=1.0, ior=1.33),
        "tea": mat("tool_tea", srgb("#6b3d1c"), rough=0.2),
        "cream": mat("tool_cream", srgb("#f1e8d4"), rough=0.4, coat=0.3),
    }


def _flat(o, axis_out=True):
    """Point an object's Z axis out of the wall."""
    o.rotation_euler = _Y
    return o


def measuring_cups(m, loc, rot_z=0.0, name="measuring_cups"):
    """Four brass measuring cups on a ring, hanging from a hook. About 0.3 m wide, 0.2 m tall."""
    p = []
    p.append(cyl(f"{name}_hook", (0, 0.03, -0.015), 0.007, 0.03, m["iron"], verts=10, bevel=0, rot=(math.radians(90), 0, 0)))
    for k in range(16):
        a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
        c0 = (0.06 * math.cos(a0), 0.0, -0.075 + 0.06 * math.sin(a0))
        c1 = (0.06 * math.cos(a1), 0.0, -0.075 + 0.06 * math.sin(a1))
        p.append(_rod(f"{name}_ring_{k}", (c0[0], 0.03 + c0[1], c0[2]), (c1[0], 0.03 + c1[1], c1[2]), 0.004, m["brass"], verts=8))
    specs = [(-0.12, 0.05, 0.075), (-0.04, 0.043, 0.066), (0.04, 0.036, 0.055), (0.115, 0.03, 0.046)]       # x, radius, height
    for k, (x, r, h) in enumerate(specs):
        prof = [(0.0, 0.0), (r * 0.9, 0.0), (r, 0.01), (r * 1.02, h)]
        cup = _lathe(f"{name}_cup_{k}", prof, m["brass"], segs=36, thick=0.0025)
        cup.location = (x, 0.045 + 0.0, -0.17)
        cup.rotation_euler = _Y
        cup.rotation_euler = (-math.pi / 2, 0, 0)
        p.append(cup)
        p.append(box(f"{name}_cup_handle_{k}", (x, 0.045 - 0.004, -0.17 + r + 0.015), (0.012, 0.007, 0.05), m["brass"], bevel=0.002))
        p.append(_rod(f"{name}_cup_link_{k}", (x, 0.04, -0.17 + r + 0.04), (0.06 * math.sin(x * 10) * 0.2 + x * 0.55, 0.03, -0.075 + 0.058), 0.002, m["brass"], verts=6))
    return _group(name, p, loc, rot_z)


def hanging_spoons(m, loc, rot_z=0.0, name="spoons"):
    """Three wooden spoons hung by their handles from a brass peg rail section. 0.3 m wide, 0.38 m tall."""
    p = []
    p.append(cyl(f"{name}_bar", (0, 0.04, 0), 0.007, 0.34, m["brass"], verts=12, bevel=0, rot=(0, math.radians(90), 0)))
    for k, (x, ln, kind) in enumerate(((-0.11, 0.33, "spoon"), (0.0, 0.3, "ladle"), (0.11, 0.35, "slotted"))):
        top = -0.02
        p.append(cyl(f"{name}_handle_{k}", (x, 0.03, top - ln / 2 + 0.03), 0.009, ln - 0.1, m["wood"], verts=14, bevel=0.002))
        p.append(sphere(f"{name}_top_{k}", (x, 0.03, top + 0.0), 0.012, m["wood"]))
        head_z = top - ln + 0.07
        if kind == "ladle":
            bowl = _lathe(f"{name}_ladle_{k}", [(0.0, 0.0), (0.03, 0.004), (0.04, 0.025), (0.042, 0.04)], m["wood"], segs=24, thick=0.004)
            bowl.location = (x, 0.03, head_z - 0.015)
            bowl.rotation_euler = (math.radians(-80), 0, 0)
            p.append(bowl)
        else:
            head = sphere(f"{name}_head_{k}", (x, 0.03, head_z), 0.034, m["wood"], scale=(0.7, 0.28, 1.25))
            p.append(head)
            if kind == "slotted":
                p.append(box(f"{name}_slot_{k}", (x, 0.052, head_z), (0.01, 0.004, 0.05), m["dark"], bevel=0))
    return _group(name, p, loc, rot_z)


def timer(m, loc, rot_z=0.0, name="timer"):
    """A wind-up kitchen timer: cream enamel drum, brass bezel, red tick marks and a brass knob. 0.12 m across, 0.08 m tall."""
    p = []
    p.append(cyl(f"{name}_body", (0, 0, 0.04), 0.06, 0.08, m["enamel"], verts=48, bevel=0.018))
    p.append(cyl(f"{name}_bezel", (0, 0, 0.082), 0.054, 0.008, m["brass"], verts=48, bevel=0.002))
    p.append(cyl(f"{name}_face", (0, 0, 0.087), 0.047, 0.004, m["cream"], verts=48, bevel=0))
    for k in range(12):
        a = math.radians(k * 30)
        t = box(f"{name}_tick_{k}", (0.038 * math.sin(a), 0.038 * math.cos(a), 0.0895), (0.003, 0.009 if k % 3 == 0 else 0.005, 0.001), m["red"], bevel=0)
        t.rotation_euler = (0, 0, -a)
        p.append(t)
    hand = box(f"{name}_hand", (0.014, 0.014, 0.0905), (0.004, 0.03, 0.001), m["red"], bevel=0)
    hand.rotation_euler = (0, 0, -math.radians(45))
    p.append(hand)
    p.append(cyl(f"{name}_pivot", (0, 0, 0.091), 0.005, 0.003, m["brass"], verts=12, bevel=0))
    p.append(cyl(f"{name}_knob_stem", (0.0, -0.06, 0.05), 0.006, 0.012, m["brass"], verts=12, bevel=0, rot=(math.radians(90), 0, 0)))
    p.append(cyl(f"{name}_knob", (0.0, -0.07, 0.05), 0.014, 0.01, m["brass"], verts=20, bevel=0.002, rot=(math.radians(90), 0, 0)))
    for s in (-1, 1):
        p.append(cyl(f"{name}_foot_{s}", (s * 0.035, 0.03, 0.003), 0.012, 0.006, m["brass"], verts=12, bevel=0))
    return _group(name, p, loc, rot_z)


def knife_block(m, loc, rot_z=0.0, name="knife_block"):
    """A slant-topped wooden knife block with five knife handles. 0.11 x 0.22 x 0.27 m."""
    p = []
    sl = [(-0.055, 0.0), (0.055, 0.0), (0.055, 0.21), (-0.055, 0.25)]             # side profile in (y, z): front 0.21, back 0.25
    verts = []
    faces = []
    for x in (-0.055, 0.055):
        for y, z in sl:
            verts.append((x, y, z + 0.015))
    # two side walls (x) share the same quad; build the box from 8 verts
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me = bpy.data.meshes.new(f"{name}_mesh")
    me.from_pydata(verts, [], faces)
    blk = bpy.data.objects.new(f"{name}_block", me)
    bpy.context.scene.collection.objects.link(blk)
    for pl in me.polygons:
        pl.use_smooth = False
    blk.data.materials.append(m["wood"])
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    mod = blk.modifiers.new("bevel", "BEVEL")
    mod.width = 0.006
    mod.segments = 2
    p.append(blk)
    for k, (x, y, ln) in enumerate(((-0.036, 0.03, 0.1), (-0.012, -0.02, 0.115), (0.012, 0.03, 0.11), (0.036, -0.02, 0.09))):
        zt = 0.265 - 0.04 * (y + 0.055) / 0.11            # the slanted top at this y
        p.append(box(f"{name}_handle_{k}", (x, y, zt + ln / 2), (0.016, 0.026, ln), m["walnut"], bevel=0.005))
        p.append(box(f"{name}_bolster_{k}", (x, y, zt + 0.003), (0.016, 0.026, 0.006), m["brass"], bevel=0.001))
    p.append(box(f"{name}_foot", (0, 0, 0.005), (0.12, 0.13, 0.01), m["walnut"], bevel=0.003))
    return _group(name, p, loc, rot_z)


def scales(m, loc, rot_z=0.0, name="scales"):
    """Kitchen scales: a cream enamel base with a dial, a brass column and a brass pan. 0.26 x 0.2 x 0.2 m."""
    p = []
    p.append(box(f"{name}_base", (0, 0, 0.035), (0.24, 0.17, 0.07), m["enamel"], bevel=0.025))
    p.append(cyl(f"{name}_dial_rim", (0, 0.086, 0.04), 0.036, 0.012, m["brass"], verts=36, bevel=0.002, rot=(math.radians(90), 0, 0)))
    p.append(cyl(f"{name}_dial", (0, 0.092, 0.04), 0.031, 0.004, m["cream"], verts=36, bevel=0, rot=(math.radians(90), 0, 0)))
    for k in range(10):
        a = math.radians(-120 + k * 26.7)
        t = box(f"{name}_tick_{k}", (0.024 * math.sin(a), 0.0945, 0.04 + 0.024 * math.cos(a)), (0.002, 0.001, 0.006), m["iron"], bevel=0)
        t.rotation_euler = (0, -a, 0)
        p.append(t)
    needle = box(f"{name}_needle", (0.008, 0.0955, 0.052), (0.002, 0.001, 0.026), m["red"], bevel=0)
    needle.rotation_euler = (0, -math.radians(30), 0)
    p.append(needle)
    p.append(cyl(f"{name}_column", (0, 0, 0.11), 0.014, 0.08, m["brass"], verts=20, bevel=0.002))
    pan = _lathe(f"{name}_pan", [(0.0, 0.0), (0.07, 0.0), (0.105, 0.018), (0.11, 0.034)], m["brass"], segs=48, thick=0.003)
    pan.location = (0, 0, 0.145)
    p.append(pan)
    return _group(name, p, loc, rot_z)


def colander(m, loc, rot_z=0.0, name="colander", yaw=25, tilt=0):
    """A cream enamel colander with two brass-ring handles, hung from a peg by one. 0.30 wide, 0.17 deep, hangs 0.2 below the peg.
    Turned yaw degrees about the peg so the room sees the open, holed bowl and a handle in profile."""
    p = []
    R = 0.125
    prof = [(0.0, 0.0), (0.05, 0.004), (0.09, 0.03), (R, 0.075), (R + 0.006, 0.09)]
    body = _lathe(f"{name}_body", prof, m["enamel"], segs=48, thick=0.004)
    body.location = (0.0, 0.0, -0.2)
    body.rotation_euler = _Y
    p.append(body)
    # the rim is a ring, not a disc: a solid one lids the bowl and hides the holes
    bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.003, minor_radius=0.005, major_segments=48, minor_segments=10,
                                     location=(0, 0.09, -0.2), rotation=_Y)
    rim = bpy.context.active_object
    rim.name = f"{name}_rim"
    rim.data.materials.append(m["brass"])
    for pl in rim.data.polygons:
        pl.use_smooth = True
    p.append(rim)
    # the holes: rings of dark dots on the inside of the bowl (y follows the profile, a hair proud of the wall)
    import random
    rnd = random.Random(5)

    def _y_at(r):
        for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
            if r0 <= r <= r1:
                return y0 + (y1 - y0) * (r - r0) / (r1 - r0)
        return prof[-1][1]

    for ring, (r, n) in enumerate(((0.02, 5), (0.045, 9), (0.07, 13), (0.095, 17), (0.115, 21))):
        for i in range(n):
            a = 2 * math.pi * (i + 0.5 * (ring % 2)) / n
            p.append(sphere(f"{name}_hole_{ring}_{i}", (r * math.cos(a), _y_at(r) + 0.003, -0.2 + r * math.sin(a)), 0.0075, m["dark"],
                            scale=(1, 0.3, 1)))
    # the handle through the top: a brass loop and a peg ring
    for s in (-1, 1):
        p.append(_rod(f"{name}_loop_{s}", (s * (R + 0.006), 0.09, -0.2), (s * (R + 0.06), 0.09, -0.2 + 0.0), 0.006, m["brass"], verts=8))
    p.append(_rod(f"{name}_strap", (0.0, 0.09, -0.2 + R + 0.0), (0, 0.04, 0.0), 0.004, m["brass"], verts=8))
    p.append(cyl(f"{name}_foot", (0, 0.0, -0.2 + 0.0), 0.04, 0.008, m["brass"], verts=24, bevel=0.002, rot=_Y))
    pivot = bpy.data.objects.new(f"{name}_pivot", None)
    bpy.context.scene.collection.objects.link(pivot)
    pivot.rotation_euler = (math.radians(tilt), 0, math.radians(yaw))
    for q in p:
        q.parent = pivot
    return _group(name, [pivot], loc, rot_z)


def skillet(m, loc, rot_z=0.0, name="skillet"):
    """A heavy cast-iron skillet hung by the hole in its handle. 0.3 wide, 0.42 tall, 0.06 deep."""
    p = []
    body = _lathe(f"{name}_body", [(0.0, 0.0), (0.105, 0.004), (0.13, 0.025), (0.142, 0.052)], m["iron"], segs=48, thick=0.006)
    body.location = (0.0, 0.0, -0.4)
    body.rotation_euler = _Y
    p.append(body)
    p.append(cyl(f"{name}_rim", (0, 0.052, -0.4), 0.145, 0.008, m["iron"], verts=48, bevel=0.003, rot=_Y))
    p.append(box(f"{name}_handle", (0, 0.022, -0.4 + 0.2), (0.032, 0.014, 0.17), m["iron"], bevel=0.005))
    p.append(cyl(f"{name}_hole_rim", (0, 0.022, -0.012), 0.022, 0.014, m["iron"], verts=24, bevel=0.003, rot=_Y))
    p.append(cyl(f"{name}_pour_l", (-0.14, 0.05, -0.4), 0.012, 0.012, m["iron"], verts=12, bevel=0, rot=_Y))
    p.append(cyl(f"{name}_helper", (0.0, 0.0, -0.4 - 0.14), 0.03, 0.015, m["iron"], verts=16, bevel=0.004, rot=_Y))
    return _group(name, p, loc, rot_z)


def cup_and_saucer(m, loc, rot_z=0.0, name="cup"):
    """A porcelain cup and saucer with a little tea in it. 0.14 across the saucer."""
    p = []
    sauc = _lathe(f"{name}_saucer", [(0.0, 0.0), (0.045, 0.002), (0.07, 0.012), (0.075, 0.02)], m["porcelain"], segs=48, thick=0.003)
    p.append(sauc)
    cup = _lathe(f"{name}_cup", [(0.0, 0.006), (0.03, 0.008), (0.045, 0.03), (0.05, 0.06), (0.052, 0.065)], m["porcelain"], segs=48, thick=0.003)
    cup.location = (0, 0, 0.004)
    p.append(cup)
    p.append(cyl(f"{name}_tea", (0, 0, 0.056), 0.045, 0.003, m["tea"], verts=36, bevel=0))
    ring = [(0.052 + 0.02 * math.sin(math.pi * t / 8), 0, 0.058 - 0.045 * t / 8 + 0.0) for t in range(9)]
    for k in range(8):
        p.append(_rod(f"{name}_handle_{k}", ring[k], ring[k + 1], 0.005, m["porcelain"], verts=8))
    p.append(cyl(f"{name}_band", (0, 0, 0.0645), 0.052, 0.003, m["brass"], verts=48, bevel=0))
    return _group(name, p, loc, rot_z)


def water_glass(m, loc, rot_z=0.0, name="glass"):
    """A tumbler of water. 0.075 across, 0.1 tall."""
    p = []
    g = _lathe(f"{name}_glass", [(0.0, 0.0), (0.032, 0.0), (0.036, 0.004), (0.039, 0.1)], m["glass"], segs=40, thick=0.003)
    p.append(g)
    p.append(cyl(f"{name}_water", (0, 0, 0.037), 0.034, 0.07, m["water"], verts=36, bevel=0))
    return _group(name, p, loc, rot_z)


TOOLS = {
    "measuring-cups": measuring_cups,
    "spoons": hanging_spoons,
    "timer": timer,
    "knife-block": knife_block,
    "scales": scales,
    "colander": colander,
    "skillet": skillet,
}
