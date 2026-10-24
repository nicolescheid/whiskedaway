"""
Cuddlecore's three "how you like it" objects: a tray of feels, a little wire cage and a glass bell jar. Same
conventions as appliances.py: built in local metres, base centred on the origin, front facing local +Y, parented to an
empty at `loc` turned by `rot_z` (0 = front faces +Y, 90 = -X, -90 = +X, 180 = -Y). Each returns that empty.

No text anywhere: the page draws the cage's tokens and the bell jar's tag (docs/art-brief-cuddlecore-tray.md).
"""
import bpy
import math

from appliances import _group, _lathe, _rod
from whisked import box, cyl, mat, sphere, srgb


def _thin_glass(name):
    """Clear glass as a Fresnel mix of mirror and see-through: the light and the eye pass straight through, so what's
    under a cloche is lit by the room (refracting glass blocks Cycles' light sampling and goes black)."""
    g = bpy.data.materials.new(name)
    g.use_nodes = True
    nt = g.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lw = nt.nodes.new("ShaderNodeLayerWeight")      # the same for a surface seen from either side (a Fresnel node isn't)
    lw.inputs["Blend"].default_value = 0.5
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 3.0
    ma = nt.nodes.new("ShaderNodeMath")
    ma.operation = "MULTIPLY_ADD"
    ma.inputs[1].default_value = 0.8
    ma.inputs[2].default_value = 0.04
    nt.links.new(lw.outputs["Facing"], pw.inputs[0])
    nt.links.new(pw.outputs["Value"], ma.inputs[0])
    gl = nt.nodes.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.02
    gl.inputs["Color"].default_value = (1, 1, 1, 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0.95, 0.98, 0.96, 1)
    nt.links.new(ma.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], mix.inputs[1])
    nt.links.new(gl.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return g


def feels_mats():
    return {
        "tray": mat("fo_tray_wood", srgb("#85592f"), rough=0.6),
        "tray_dark": mat("fo_tray_dark", srgb("#3b2616"), rough=0.7),
        "cream": mat("fo_saucer_cream", srgb("#efe5cf"), rough=0.3, coat=0.5),
        "sage": mat("fo_saucer_sage", srgb("#7a926c"), rough=0.32, coat=0.5),
        "honey": mat("fo_saucer_honey", srgb("#dca94a"), rough=0.3, coat=0.5),
        "berry": mat("fo_saucer_berry", srgb("#9a4f5f"), rough=0.32, coat=0.5),
        "blue": mat("fo_saucer_blue", srgb("#5f7f98"), rough=0.32, coat=0.5),
        "chilli": mat("fo_chilli", srgb("#c4301f"), rough=0.3, coat=0.4),
        "stem": mat("fo_stem", srgb("#4d6a2d"), rough=0.5),
        "cinnamon": mat("fo_cinnamon", srgb("#8a4b25"), rough=0.7),
        "anise": mat("fo_anise", srgb("#4b2a18"), rough=0.6),
        "okra": mat("fo_okra", srgb("#8fae50"), rough=0.5),
        "okra_in": mat("fo_okra_in", srgb("#d8e0a2"), rough=0.5),
        "mush": mat("fo_mushroom", srgb("#d9c3a2"), rough=0.6),
        "mush_stem": mat("fo_mushroom_stem", srgb("#eadfca"), rough=0.7),
        "lemon": mat("fo_lemon", srgb("#f0c93a"), rough=0.4),
        "lemon_in": mat("fo_lemon_flesh", srgb("#f6e48a"), rough=0.35),
        "leaf": mat("fo_coriander", srgb("#4f8a34"), rough=0.5),
        "nut": mat("fo_nut", srgb("#b58c58"), rough=0.7),
        "iron": mat("fo_cage_iron", srgb("#26231f"), rough=0.5, metal=0.85),
        "brass": mat("fo_brass", srgb("#a98640"), rough=0.4, metal=1.0),
        "base_wood": mat("fo_jar_base", srgb("#a2693a"), rough=0.5),
        "glass": _thin_glass("fo_glass"),
        "grapefruit": mat("fo_grapefruit", srgb("#e0705a"), rough=0.3),
        "grapefruit_rind": mat("fo_grapefruit_rind", srgb("#e8b650"), rough=0.5),
        "pith": mat("fo_pith", srgb("#f3e3c4"), rough=0.5),
        "tin": mat("fo_liquorice_tin", srgb("#7a2f26"), rough=0.4, metal=0.3),
        "cheese": mat("fo_cheese", srgb("#e2b24e"), rough=0.55),
        "cheese_rind": mat("fo_cheese_rind", srgb("#a8741f"), rough=0.7),
        "bottle": mat("fo_bottle", srgb("#33472f"), rough=0.1, transmission=0.15, ior=1.5),
        "cork": mat("fo_cork", srgb("#b3905f"), rough=0.9),
        "green": mat("fo_greens", srgb("#3f7a30"), rough=0.5),
    }


def _prism(name, pts, h, material, z0=0.0):
    """A flat prism: polygon `pts` (x, y) extruded up from z0 by h."""
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z0 + h) for x, y in pts]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    mod = o.modifiers.new("bevel", "BEVEL")
    mod.width = 0.0015
    mod.segments = 2
    return o


def _at(o, loc=None, rot=None):
    if loc is not None:
        o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    return o


def _move(o, loc):
    o.location = loc
    return o


# ---------------------------------------------------------------- the tray of feels
def feels_tray(m, loc, rot_z=0.0, name="feels_tray", scale=1.0, tilt_deg=11):
    """A small worn wooden serving tray, 0.35 x 0.25 m, low rim and two cut-out handles, with seven little dishes of
    feels on it (chilli, cinnamon and star anise, okra, mushroom, lemon wedge, coriander, nuts). Top of the rim 0.05 m."""
    p = []
    L, Dp, T = 0.35, 0.25, 0.014
    p.append(box(f"{name}_floor", (0, 0, T / 2), (L, Dp, T), m["tray"], bevel=0.004))
    for s in (-1, 1):   # long sides: low rim
        p.append(box(f"{name}_side_{s}", (0, s * (Dp / 2 - 0.007), 0.026), (L, 0.014, 0.038), m["tray"], bevel=0.004))
    for s in (-1, 1):   # short ends: taller, with a cut-out handle slot
        p.append(box(f"{name}_end_{s}", (s * (L / 2 - 0.007), 0, 0.034), (0.014, Dp, 0.054), m["tray"], bevel=0.004))
        p.append(box(f"{name}_slot_{s}", (s * (L / 2 - 0.007), 0, 0.04), (0.018, 0.09, 0.016), m["tray_dark"], bevel=0.006))
    z0 = T
    # back row (4 small saucers at y=+0.05), front row (3 larger at y=-0.045)
    back = [(-0.12, "cream"), (-0.04, "sage"), (0.04, "honey"), (0.12, "blue")]
    front = [(-0.095, "berry"), (0.0, "cream"), (0.095, "sage")]
    for i, (x, c) in enumerate(back):
        p.append(_move(_lathe(f"{name}_saucer_b{i}", [(0.0, 0.0), (0.026, 0.0), (0.036, 0.009), (0.037, 0.012)], m[c], segs=40, thick=0.003),
                       (x, 0.052, z0)))
    for i, (x, c) in enumerate(front):
        p.append(_move(_lathe(f"{name}_saucer_f{i}", [(0.0, 0.0), (0.03, 0.0), (0.042, 0.01), (0.043, 0.014)], m[c], segs=40, thick=0.003),
                       (x, -0.048, z0)))
    zb, zf = z0 + 0.004, z0 + 0.004
    # back 0: a red chilli (three joined pods curving) with a green stem
    cx, cy = -0.12, 0.052
    for k, (dx, dy, sx) in enumerate(((-0.012, -0.004, 0.022), (0.012, 0.0, 0.022), (0.034, 0.012, 0.014))):
        c = sphere(f"{name}_chilli_{k}", (cx + dx, cy + dy, zb + 0.011), 0.011, m["chilli"], scale=(sx / 0.011, 1.0, 1.0))
        c.rotation_euler = (0, 0, math.radians(15 + 12 * k))
        p.append(c)
    p.append(_rod(f"{name}_chilli_stem", (cx - 0.034, cy - 0.008, zb + 0.014), (cx - 0.044, cy - 0.012, zb + 0.022), 0.0035, m["stem"], verts=8))
    # back 1: a cinnamon stick and a star anise
    cx = -0.04
    p.append(_rod(f"{name}_cinnamon", (cx - 0.026, cy - 0.016, zb + 0.008), (cx + 0.026, cy + 0.014, zb + 0.01), 0.0075, m["cinnamon"], verts=12))
    for k in range(8):
        a = math.radians(k * 45)
        arm = sphere(f"{name}_anise_{k}", (cx + 0.012 + 0.0125 * math.cos(a), cy - 0.014 + 0.0125 * math.sin(a), zb + 0.004),
                     0.006, m["anise"], scale=(1.5, 0.8, 0.7))
        arm.rotation_euler = (0, 0, a)
        p.append(arm)
    p.append(sphere(f"{name}_anise_core", (cx + 0.012, cy - 0.014, zb + 0.005), 0.005, m["anise"]))
    # back 2: a slice of okra
    cx = 0.04
    p.append(_move(cyl(f"{name}_okra", (0, 0, 0), 0.02, 0.01, m["okra"], verts=5, bevel=0.003), (cx - 0.008, cy + 0.004, zb + 0.005)))
    p.append(_move(cyl(f"{name}_okra_cut", (0, 0, 0), 0.014, 0.0105, m["okra_in"], verts=5, bevel=0.002), (cx - 0.008, cy + 0.004, zb + 0.0053)))
    p.append(_move(cyl(f"{name}_okra2", (0, 0, 0), 0.016, 0.009, m["okra"], verts=5, bevel=0.003), (cx + 0.016, cy - 0.008, zb + 0.0045)))
    # back 3: a mushroom (cap and stem)
    cx = 0.12
    p.append(sphere(f"{name}_mush_cap", (cx, cy, zb + 0.022), 0.021, m["mush"], scale=(1, 1, 0.6)))
    p.append(cyl(f"{name}_mush_stem", (cx, cy, zb + 0.009), 0.0085, 0.018, m["mush_stem"], verts=16, bevel=0.002))
    # front 0: a lemon wedge (half-disc prism, rind and flesh)
    cx, fy = -0.095, -0.048
    half = [(0.03 * math.cos(math.radians(a)), 0.03 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    rind = _prism(f"{name}_lemon_rind", half, 0.012, m["lemon"], zb)
    rind.location, rind.rotation_euler = (cx, fy - 0.014, 0), (0, 0, math.radians(8))
    p.append(rind)
    inner = [(0.025 * math.cos(math.radians(a)), 0.025 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    flesh = _prism(f"{name}_lemon_flesh", inner, 0.0125, m["lemon_in"], zb)
    flesh.location, flesh.rotation_euler = (cx, fy - 0.014, 0), (0, 0, math.radians(8))
    p.append(flesh)
    # front 1: a sprig of coriander (stems and flat serrated leaves)
    cx = 0.0
    p.append(_rod(f"{name}_cor_stem_a", (cx - 0.03, fy - 0.012, zb + 0.003), (cx + 0.004, fy + 0.004, zb + 0.006), 0.0022, m["stem"], verts=6))
    p.append(_rod(f"{name}_cor_stem_b", (cx + 0.004, fy + 0.004, zb + 0.006), (cx + 0.026, fy + 0.026, zb + 0.008), 0.0018, m["stem"], verts=6))
    p.append(_rod(f"{name}_cor_stem_c", (cx + 0.004, fy + 0.004, zb + 0.006), (cx + 0.03, fy - 0.014, zb + 0.008), 0.0018, m["stem"], verts=6))
    for k, (dx, dy, rz) in enumerate(((0.032, 0.03, 40), (0.014, 0.018, 70), (0.036, -0.016, -30), (0.02, -0.008, -10),
                                       (-0.004, 0.012, 100), (-0.016, -0.008, 150))):
        lf = sphere(f"{name}_cor_leaf_{k}", (cx + dx, fy + dy, zb + 0.01), 0.0095, m["leaf"], scale=(1.0, 1.0, 0.22))
        lf.rotation_euler = (0, 0, math.radians(rz))
        p.append(lf)
    # front 2: nuts in their shells
    cx = 0.095
    for k, (dx, dy, r) in enumerate(((-0.014, 0.01, 0.0135), (0.012, 0.014, 0.0125), (0.0, -0.014, 0.013), (0.026, -0.008, 0.011))):
        n = sphere(f"{name}_nut_{k}", (cx + dx, fy + dy, zb + r * 0.85), r, m["nut"], scale=(1.0, 0.88, 1.0))
        n.rotation_euler = (0, 0, math.radians(k * 53))
        p.append(n)
        ridge = box(f"{name}_nut_ridge_{k}", (cx + dx, fy + dy, zb + r * 1.7), (r * 1.6, 0.0016, 0.0016), m["tray_dark"], bevel=0)
        ridge.rotation_euler = (0, 0, math.radians(k * 53))
        p.append(ridge)
    # propped at the back on two little wooden blocks, so the dishes show from eye height (front edge stays on the surface)
    from mathutils import Matrix
    t = Matrix.Translation((0, Dp / 2, 0)) @ Matrix.Rotation(-math.radians(tilt_deg), 4, "X") @ Matrix.Translation((0, -Dp / 2, 0))
    for o in p:
        o.matrix_basis = t @ o.matrix_basis
    lift = Dp * math.sin(math.radians(tilt_deg))
    for s_ in (-1, 1):
        p.append(box(f"{name}_block_{s_}", (s_ * 0.11, -Dp / 2 + 0.03, lift * 0.45), (0.05, 0.05, lift * 0.9), m["tray_dark"], bevel=0.004))
    root = _group(name, p, loc, rot_z)
    root.scale = (scale,) * 3
    bpy.context.view_layer.update()
    return root


# ---------------------------------------------------------------- the little cage
def little_cage(m, loc, rot_z=0.0, name="little_cage", open_deg=62):
    """A domed wire birdcage in black iron with brass trim and a ring at the top, 0.25 m tall, 0.17 m across. The door
    at the front (local +Y) stands slightly open, hinged on its left. The inside is empty and evenly open."""
    p = []
    R, base_h, wire_h = 0.085, 0.014, 0.135
    zb = base_h
    p.append(cyl(f"{name}_base", (0, 0, base_h / 2), R + 0.008, base_h, m["iron"], verts=48, bevel=0.003))
    p.append(cyl(f"{name}_base_trim", (0, 0, base_h), R + 0.004, 0.004, m["brass"], verts=48, bevel=0.0012))
    p.append(cyl(f"{name}_floor_plate", (0, 0, base_h + 0.002), R - 0.004, 0.003, m["iron"], verts=48, bevel=0))
    ztop = zb + wire_h
    for z in (zb + 0.002, ztop):
        for k in range(48):
            a0, a1 = 2 * math.pi * k / 48, 2 * math.pi * (k + 1) / 48
            p.append(_rod(f"{name}_ring_{z:.3f}_{k}", (R * math.cos(a0), R * math.sin(a0), z), (R * math.cos(a1), R * math.sin(a1), z), 0.0022, m["iron"], verts=6))
    # vertical bars: 20 around, with a gap at the front for the door (door spans about +-26 degrees around +Y)
    door_half = math.radians(25)
    for k in range(20):
        a = 2 * math.pi * k / 20
        if abs(((a - math.pi / 2 + math.pi) % (2 * math.pi)) - math.pi) < door_half:
            continue
        p.append(_rod(f"{name}_bar_{k}", (R * math.cos(a), R * math.sin(a), zb), (R * math.cos(a), R * math.sin(a), ztop), 0.0017, m["iron"], verts=6))
    # dome: 10 ribs from the top ring of the walls up to a collar at the apex
    apex_z = ztop + 0.075
    steps = 6
    for k in range(10):
        a = 2 * math.pi * k / 10
        prev = (R * math.cos(a), R * math.sin(a), ztop)
        for s in range(1, steps + 1):
            t = s / steps
            rr = R * math.cos(t * math.pi / 2) ** 0.9
            zz = ztop + (apex_z - ztop) * math.sin(t * math.pi / 2)
            cur = (rr * math.cos(a), rr * math.sin(a), zz)
            p.append(_rod(f"{name}_rib_{k}_{s}", prev, cur, 0.0019, m["iron"], verts=6))
            prev = cur
    # a mid ring on the dome
    t = 0.5
    rr, zz = R * math.cos(t * math.pi / 2) ** 0.9, ztop + (apex_z - ztop) * math.sin(t * math.pi / 2)
    for k in range(32):
        a0, a1 = 2 * math.pi * k / 32, 2 * math.pi * (k + 1) / 32
        p.append(_rod(f"{name}_domering_{k}", (rr * math.cos(a0), rr * math.sin(a0), zz), (rr * math.cos(a1), rr * math.sin(a1), zz), 0.0017, m["iron"], verts=6))
    p.append(sphere(f"{name}_collar", (0, 0, apex_z), 0.011, m["brass"]))
    # the ring on top (a torus drawn as a polygon of rods, standing up)
    rz, rr2 = apex_z + 0.022, 0.022
    for k in range(20):
        a0, a1 = 2 * math.pi * k / 20, 2 * math.pi * (k + 1) / 20
        p.append(_rod(f"{name}_top_ring_{k}", (rr2 * math.cos(a0), 0, rz + rr2 * math.sin(a0)), (rr2 * math.cos(a1), 0, rz + rr2 * math.sin(a1)), 0.0024, m["brass"], verts=6))
    # the door: a rectangle of iron with three bars, hinged at its left (as seen from the front), swung open outward
    dw = 2 * R * math.sin(door_half) - 0.002
    dh = wire_h - 0.006
    hinge = (-dw / 2 + 0.0, R * math.cos(door_half) * 0.0 + (R * math.cos(door_half)), 0)
    hx, hy = -R * math.sin(door_half), R * math.cos(door_half)
    door = []
    dz0 = zb + 0.004
    door.append(_rod(f"{name}_door_l", (0, 0, dz0), (0, 0, dz0 + dh), 0.0022, m["iron"], verts=6))
    door.append(_rod(f"{name}_door_r", (dw, 0, dz0), (dw, 0, dz0 + dh), 0.0022, m["iron"], verts=6))
    door.append(_rod(f"{name}_door_t", (0, 0, dz0 + dh), (dw, 0, dz0 + dh), 0.0022, m["iron"], verts=6))
    door.append(_rod(f"{name}_door_b", (0, 0, dz0), (dw, 0, dz0), 0.0022, m["iron"], verts=6))
    for i in (1, 2, 3):
        door.append(_rod(f"{name}_door_bar{i}", (dw * i / 4, 0, dz0), (dw * i / 4, 0, dz0 + dh), 0.0016, m["iron"], verts=6))
    door.append(sphere(f"{name}_latch", (dw, 0.004, dz0 + dh * 0.5), 0.004, m["brass"]))
    pivot = bpy.data.objects.new(f"{name}_door_pivot", None)
    bpy.context.scene.collection.objects.link(pivot)
    pivot.location = (hx, hy, 0)
    pivot.rotation_euler = (0, 0, math.radians(open_deg))   # opens outward and to the viewer's left
    bpy.context.view_layer.update()
    for d in door:
        d.parent = pivot
    p.append(pivot)
    return _group(name, p, loc, rot_z)


# ---------------------------------------------------------------- the bell jar
def bell_jar(m, loc, rot_z=0.0, name="bell_jar"):
    """A clear glass cloche on a round wooden base, 0.30 m tall, with half a grapefruit, a plain liquorice tin, a wedge
    of aged cheese, a little cooking-wine bottle and a bunch of leafy greens inside. No label, no tag."""
    p = []
    R = 0.098
    p.append(_lathe(f"{name}_base", [(0.0, 0.0), (R + 0.022, 0.0), (R + 0.024, 0.008), (R + 0.02, 0.018), (R + 0.008, 0.021), (0.0, 0.021)],
                    m["base_wood"], segs=64, thick=0.002))
    p.append(cyl(f"{name}_base_core", (0, 0, 0.0105), R + 0.02, 0.021, m["base_wood"], verts=64, bevel=0.005))
    zb = 0.021
    prof = [(R, zb), (R, zb + 0.14)]
    for k in range(1, 9):
        t = k / 8
        prof.append((R * math.cos(t * math.pi / 2) ** 0.85 + 0.0, zb + 0.14 + 0.105 * math.sin(t * math.pi / 2)))
    prof[-1] = (0.013, prof[-1][1])
    gl = _lathe(f"{name}_glass", prof, m["glass"], segs=64, thick=0.0032)
    ztop = prof[-1][1]
    kn = sphere(f"{name}_knob", (0, 0, ztop + 0.012), 0.016, m["glass"])
    kneck = cyl(f"{name}_knob_neck", (0, 0, ztop + 0.002), 0.009, 0.012, m["glass"], verts=24, bevel=0)
    for g in (gl, kn, kneck):
        g.visible_shadow = False       # Cycles can't shine light through glass to what's under it
        p.append(g)
    # contents (a still life: back row greens + bottle, front row grapefruit, tin, cheese)
    # the viewer is on -Y of the jar (local front = +Y, group rotates it toward the room)
    # leafy greens: a fan of flat leaves on stems
    gx, gy = -0.04, -0.03
    for k in range(7):
        a = math.radians(-42 + k * 14)
        base = (gx, gy, zb + 0.003)
        top = (gx + 0.05 * math.sin(a), gy, zb + 0.09 + 0.012 * math.cos(a))
        p.append(_rod(f"{name}_green_stem_{k}", base, top, 0.0022, m["green"], verts=6))
        lf = sphere(f"{name}_green_leaf_{k}", ((base[0] + top[0]) / 2 + 0.01 * math.sin(a), gy - 0.004, (base[2] + top[2]) / 2 + 0.03),
                    0.022, m["green"], scale=(0.5, 0.16, 1.5))
        lf.rotation_euler = (0, -a, 0)
        p.append(lf)
    # the cooking-wine bottle (unlabelled, dark glass)
    bx, by = 0.035, -0.03
    p.append(_move(_lathe(f"{name}_bottle", [(0.0, 0.0), (0.0235, 0.0), (0.0245, 0.005), (0.0245, 0.07), (0.02, 0.085), (0.0105, 0.1),
                                              (0.0095, 0.125), (0.0105, 0.13)], m["bottle"], segs=36, thick=0.0025), (bx, by, zb)))
    p.append(cyl(f"{name}_cork", (bx, by, zb + 0.131), 0.0085, 0.014, m["cork"], verts=16, bevel=0.002))
    # half a grapefruit, cut face toward the viewer (leaning)
    fx, fy = -0.04, 0.04
    dome = [(0.046 * math.sin(t * math.pi / 2), 0.046 * math.cos(t * math.pi / 2)) for t in [k / 8 for k in range(9)]]
    rind = _lathe(f"{name}_gf_rind", dome, m["grapefruit_rind"], segs=40, thick=0.004)
    rind.location, rind.rotation_euler = (fx, fy, zb + 0.047), (math.radians(90), 0, 0)
    p.append(rind)
    flesh = cyl(f"{name}_gf_flesh", (0, 0, 0), 0.0425, 0.003, m["grapefruit"], verts=40, bevel=0)
    flesh.location, flesh.rotation_euler = (fx, fy + 0.0, zb + 0.047), (math.radians(90), 0, 0)
    p.append(flesh)
    for k in range(10):
        a = math.radians(k * 36)
        seg = box(f"{name}_gf_seg_{k}", (0, 0, 0), (0.0012, 0.0012, 0.036), m["pith"], bevel=0)
        seg.location = (fx + 0.0185 * math.cos(a), fy + 0.0022, zb + 0.047 + 0.0185 * math.sin(a))
        seg.rotation_euler = (0, math.pi / 2 - a, 0)
        p.append(seg)
    # a plain round liquorice tin (dark, no print)
    p.append(cyl(f"{name}_tin", (0.015, 0.045, zb + 0.016), 0.034, 0.032, m["tin"], verts=40, bevel=0.003))
    p.append(cyl(f"{name}_tin_lid", (0.015, 0.045, zb + 0.034), 0.0355, 0.006, m["tin"], verts=40, bevel=0.002))
    # a wedge of aged cheese
    tri = [(-0.034, -0.02), (0.034, -0.02), (0.034, 0.03), (-0.034, 0.02)]
    ch = _prism(f"{name}_cheese", [(-0.04, 0.0), (0.04, 0.0), (0.0, 0.05)], 0.034, m["cheese"], 0)
    ch.location, ch.rotation_euler = (0.045, 0.02, zb), (0, 0, math.radians(130))
    p.append(ch)
    rim = _prism(f"{name}_cheese_rind", [(-0.04, 0.0), (0.04, 0.0), (0.04, -0.004), (-0.04, -0.004)], 0.034, m["cheese_rind"], 0)
    rim.location, rim.rotation_euler = (0.045, 0.02, zb), (0, 0, math.radians(130))
    p.append(rim)
    return _group(name, p, loc, rot_z)


FEELS_OBJECTS = {"feels-tray": feels_tray, "cage": little_cage, "bell-jar": bell_jar}
