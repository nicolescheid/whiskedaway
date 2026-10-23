"""
Cuddlecore Kitchen: builds the room, renders a 360 equirectangular panorama with Cycles,
and writes hotspot angles (yaw/pitch) for the browser viewer.

Needs the CC0 Poly Haven assets first:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/cuddlecore_build.py -- [--preview] [--no-render]
Fly-through video frames instead of the panorama (docs/flythrough-plan.md, shots 6 and 7):
  blender -b --factory-startup --python blender/cuddlecore_build.py -- --flythrough [--rough]

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from appliances import APPLIANCES, appliance_mats  # noqa: E402
from tools import TOOLS, cup_and_saucer, tool_mats, water_glass  # noqa: E402
from whisked import emission_mat, window_glass  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS   # rebuild .blend + hotspots only
WEATHER = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--weather=")), "rain")

# One look per barometer reading. view: ChatGPT backdrop; sky: world strength and tint; sun: (watts/m2, colour,
# elevation deg, azimuth deg) or None; bounce: cool window fill; flames: candles and lamp lit; dial: needle angle.
WEATHERS = {
    "rain":     dict(view="14-window-rain.png", dial=-30, sky=1.1, tint=(1.0, 1.0, 1.0), backdrop=0.7, sun=None,
                     bounce=(70, (0.78, 0.86, 1.0)), wet=0.5, flames=1.0, fill=22, exposure=0.55),
    "fair":     dict(view="15-window-fair.png", dial=30, sky=2.0, tint=(1.0, 0.97, 0.92), backdrop=1.1,
                     sun=(9.0, (1.0, 0.93, 0.8), 32, 25), bounce=(110, (1.0, 0.97, 0.92)), wet=0.0, flames=0.0,
                     fill=10, exposure=0.62),
    "change":   dict(view="16-window-change.png", dial=0, sky=1.5, tint=(0.95, 0.98, 1.0), backdrop=0.85, sun=None,
                     bounce=(105, (0.92, 0.95, 1.0)), wet=0.0, flames=0.7, fill=16, exposure=0.55),
    "stormy":   dict(view="17-window-stormy.png", dial=-60, sky=0.5, tint=(0.85, 0.9, 1.0), backdrop=0.45, sun=None,
                     bounce=(32, (0.7, 0.8, 1.0)), wet=0.75, flames=1.5, fill=18, exposure=0.62),
    "very-dry": dict(view="18-window-very-dry.png", dial=60, sky=2.3, tint=(1.0, 0.92, 0.8), backdrop=1.2,
                     sun=(10.0, (1.0, 0.86, 0.66), 24, -20), bounce=(100, (1.0, 0.92, 0.82)), wet=0.0, flames=0.0,
                     fill=8, exposure=0.62),
}
WX = dict(WEATHERS[WEATHER])
VIEW_SAT = 1.0   # backdrop saturation boost, per weather with view_sat

# Late night: the same weather after dark. ChatGPT's night view outside, a near-black sky with a
# little cool moonlight at the window, and every candle and the lamp lit, whatever the weather.
NIGHT = "--night" in ARGS
NIGHT_VIEWS = {"rain": "19-night-rain.png", "fair": "20-night-fair.png", "change": "21-night-change.png",
               "stormy": "22-night-stormy.png", "very-dry": "23-night-very-dry.png"}
if NIGHT:
    WX.update(view=NIGHT_VIEWS[WEATHER], sky=0.04, tint=(0.55, 0.62, 1.0), backdrop=0.8, sun=None,
              bounce=(5, (0.55, 0.62, 1.0)), flames=1.4, fill=7, exposure=0.85)

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
    # Bake only the scale: keeping the origin at loc means a later rotation turns the box in place
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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


def hotspot(key, label, overlay, target, kind="interactive", appliance=None):
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
    if appliance:
        HOTSPOTS[key]["appliance"] = appliance


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


# ---------------------------------------------------------------- concept-pack helpers

CONCEPT = os.path.join(os.path.dirname(HERE), "art-inbox", "cuddlecore")


def retint(root, hex_color, lo=0.55, hi=1.15):
    """Repaint a model in hex_color while keeping its texture's wear and dirt as light/dark variation."""
    tint = srgb(hex_color)
    for o in meshes_of(root):
        for m in o.data.materials:
            if not m or not m.node_tree:
                continue
            nt = m.node_tree
            p = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not p or not p.inputs["Base Color"].is_linked:
                continue
            src = p.inputs["Base Color"].links[0].from_socket
            bw = nt.nodes.new("ShaderNodeRGBToBW")
            nt.links.new(src, bw.inputs["Color"])
            rng = nt.nodes.new("ShaderNodeMapRange")
            rng.inputs["To Min"].default_value = lo
            rng.inputs["To Max"].default_value = hi
            nt.links.new(bw.outputs["Val"], rng.inputs["Value"])
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[6].default_value = tint
            nt.links.new(rng.outputs["Result"], mix.inputs[7])
            nt.links.new(mix.outputs[2], p.inputs["Base Color"])


def swap_material(root, material):
    for o in meshes_of(root):
        o.data.materials.clear()
        o.data.materials.append(material)


def image_mat(name, path, rough=0.85, tile=None, normal_from=None, normal_strength=0.6):
    """Principled material from a flat image (ChatGPT artwork / fabric). tile = metres per repeat, else UVs."""
    m = bpy.data.materials.new(name)
    nt, p = principled(m)
    p.inputs["Roughness"].default_value = rough
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    if tile:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / tile,) * 3
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        t.projection = "BOX"
        t.projection_blend = 0.3
    nt.links.new(t.outputs["Color"], p.inputs["Base Color"])
    if normal_from:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(ASSETS, "textures", normal_from, "nor.jpg"), check_existing=True)
        n.image.colorspace_settings.name = "Non-Color"
        if tile:
            nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
            n.projection = "BOX"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    return m


def wall_picture(name, path, center, size, facing, material=None):
    """A flat picture on a wall. facing: '-y' (front wall, faces into the room) or '+y' (back wall)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=center,
                                     rotation=(math.radians(90), 0, 0 if facing == "-y" else math.radians(180)))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material or image_mat(f"{name}_art", path, rough=0.8))
    return o


def curtain(name, cx, y, z_top, width, height, material, pleats=8, amp=0.035, seed=0):
    """A gathered linen curtain built as a pleated mesh: fuller folds toward the hem."""
    import random
    rnd = random.Random(seed)
    nx, nz = pleats * 10, 48
    verts, faces = [], []
    for k in range(nz):
        t = k / (nz - 1)
        for i in range(nx):
            u = i / (nx - 1)
            fold = math.sin(u * pleats * 2 * math.pi + rnd.uniform(-0.05, 0.05))
            depth = amp * fold * (0.7 + 0.6 * t)
            x = cx - width / 2 + width * u + (0.04 * t * (u - 0.5))   # slight flare at the hem
            verts.append((x, y + depth, z_top - height * t + 0.01 * math.sin(u * 9 + seed) * t))
    for k in range(nz - 1):
        for i in range(nx - 1):
            a = k * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.004
    for poly in mesh.polygons:
        poly.use_smooth = True
    o.data.materials.append(material)
    return o


def drape(name, size, cuts, loc, rot, material, colliders, frames=70):
    """Drop a cloth sheet onto colliders and keep the settled shape (used for the knitted throw)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=cuts)
    bpy.ops.object.mode_set(mode="OBJECT")
    for c in colliders:
        if not any(m.type == "COLLISION" for m in c.modifiers):
            col = c.modifiers.new("collide", "COLLISION")
            c.collision.thickness_outer = 0.008
    cloth = o.modifiers.new("Cloth", "CLOTH")
    s = cloth.settings
    s.quality = 8
    s.mass = 0.6
    s.tension_stiffness = s.compression_stiffness = 8
    s.bending_stiffness = 0.1
    cloth.collision_settings.distance_min = 0.006
    cloth.collision_settings.use_self_collision = True
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, frames
    for f in range(1, frames + 1):
        scene.frame_set(f)
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        bpy.ops.object.modifier_apply(modifier="Cloth")
    for c in colliders:
        for m in [m for m in c.modifiers if m.type == "COLLISION"]:
            c.modifiers.remove(m)
    scene.frame_set(1)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.014
    o.modifiers.new("smooth", "SUBSURF").levels = 1
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.append(material)
    return o


# ---------------------------------------------------------------- the energy candles

LIT_CANDLES = False   # the page lights the chosen one (a flame overlay), so the render shows them all unlit

# Five pillar candles in a row, left to right as seen from the room: how much energy you have today.
# (key, body height, wax pool radius, flame size, light watts). The keys match explore/cuddlecore-world.json.
CANDLES = [("burnt-out", 0.016, 0.052, 0.0, 0.0),
           ("low", 0.045, 0.06, 0.7, 2.5),
           ("half", 0.09, 0.0, 1.0, 4.0),
           ("three-quarters", 0.135, 0.0, 1.05, 4.5),
           ("full", 0.18, 0.0, 1.35, 7.5)]


def energy_candles(x, z0, cast_iron):
    """The candles stand on the left counter (z0 = worktop) at x, spaced along the wall. They're always lit,
    whatever the weather: the flames are part of what each one says. Each is its own hotspot."""
    copper = mat("candle_dish", srgb("#8a5a35"), rough=0.45, metal=0.85)

    def wax(name, hex_color, rough):
        m = mat(name, srgb(hex_color), rough=rough)
        p = m.node_tree.nodes["Principled BSDF"]
        p.inputs["Subsurface Weight"].default_value = 0.45
        p.inputs["Subsurface Radius"].default_value = (1.0, 0.75, 0.35)   # honey-warm glow, not the default red
        p.inputs["Subsurface Scale"].default_value = 0.012
        return m

    candle_wax = wax("candle_wax", "#e6b04a", 0.45)
    molten = wax("molten_wax", "#e0a038", 0.15)
    flame = mat("candle_flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.5, 0.16, 1), strength=6)
    smoke = bpy.data.materials.new("smoke")
    smoke.use_nodes = True
    snt = smoke.node_tree
    snt.nodes.remove(snt.nodes["Principled BSDF"])
    haze = snt.nodes.new("ShaderNodeBsdfDiffuse")
    haze.inputs["Color"].default_value = srgb("#c9c2b8")
    see = snt.nodes.new("ShaderNodeBsdfTransparent")
    mix = snt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.72                 # mostly see-through
    snt.links.new(haze.outputs[0], mix.inputs[1])
    snt.links.new(see.outputs[0], mix.inputs[2])
    snt.links.new(mix.outputs[0], snt.nodes["Material Output"].inputs["Surface"])
    r = 0.035
    lit = WX["flames"] or 1.0                          # brighter at night, as the other candles are
    for i, (key, h, pool, size, watts) in enumerate(CANDLES):
        y = -0.2 + i * 0.14
        parts = [cyl(f"candle_dish_{key}", (x, y, z0 + 0.007), 0.062, 0.014, copper, bevel=0.005)]
        bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.005, location=(x, y, z0 + 0.014))
        bpy.context.active_object.data.materials.append(copper)
        base = z0 + 0.014
        if pool:                                       # wax that has run down and pooled in the dish
            parts.append(cyl(f"candle_pool_{key}", (x, y, base + 0.003), pool, 0.006, molten, bevel=0.003))
        body = cyl(f"candle_{key}", (x, y, base + h / 2), r, h, candle_wax, bevel=0.006)
        parts.append(body)
        top = base + h
        cyl(f"candle_melt_{key}", (x, y, top + 0.0005), r * 0.78, 0.002, molten, bevel=0)   # proud of the top: no coplanar faces
        # a few drips down the side that faces the room (+X)
        for k, (ang, ln) in enumerate(((-35, 0.03), (10, 0.05), (40, 0.022))[: 1 if h < 0.05 else 3]):
            a = math.radians(ang)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0055, location=(x + r * math.cos(a), y + r * math.sin(a),
                                                                          top - min(ln, h * 0.6) / 2))
            d = bpy.context.active_object
            d.scale = (1, 1, min(ln, h * 0.6) / 0.011)
            bpy.ops.object.shade_smooth()
            d.data.materials.append(candle_wax)
        wick = cyl(f"candle_wick_{key}", (x, y, top + 0.006), 0.0016, 0.012, cast_iron, verts=8, bevel=0)
        # Unlit since the check-in (checkin-views.md): the page draws a flame on the candle the visitor lights.
        # The flame point goes in the hotspot; LIT_CANDLES = True brings the rendered flames back.
        flame_at = (x, y, top + 0.012 + 0.019 * max(size, 0.6))
        if not size:
            wick.rotation_euler = (math.radians(25), 0, 0)   # spent and bent over
        if size and LIT_CANDLES:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.009 * size, location=(x, y, top + 0.012 + 0.019 * size))
            f = bpy.context.active_object
            f.name = f"candle_flame_{key}"
            f.scale = (1, 1, 2.3)
            bpy.ops.object.shade_smooth()
            f.data.materials.append(flame)
            f.visible_shadow = False                   # the flame is the light: it mustn't shade its own candle
            parts.append(f)
            point_light(f"candle_light_{key}", (x + 0.02, y, top + 0.03 * size), watts * lit, (1.0, 0.52, 0.2), radius=0.012)
        elif not size and LIT_CANDLES:
            smoke_curl(f"candle_smoke_{key}", (x, y, top + 0.012), smoke)
        hotspot(f"candle-{key}", key.replace("-", " ").capitalize(), "energy", parts, kind="energy")
        fx, fy, fz = flame_at
        HOTSPOTS[f"candle-{key}"]["flame"] = {"yaw": round(math.degrees(math.atan2(fx, fy)), 2),
                                              "pitch": round(math.degrees(math.atan2(fz - EYE, math.hypot(fx, fy))), 2),
                                              "distance": round(math.sqrt(fx * fx + fy * fy + (fz - EYE) ** 2), 2)}


def smoke_curl(name, start, material):
    """A thin wisp rising from a just-snuffed wick, drifting and thinning as it goes."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.0022
    curve.bevel_resolution = 3
    spline = curve.splines.new("NURBS")
    n = 14
    spline.points.add(n - 1)
    x0, y0, z0 = start
    for k, pt in enumerate(spline.points):
        t = k / (n - 1)
        sway = 0.012 * math.sin(t * 7.0) * (0.3 + t)
        pt.co = (x0 + 0.006 * t + sway * 0.4, y0 + sway, z0 + 0.16 * t, 1.0)
        pt.radius = 1.0 - 0.85 * t
    spline.use_endpoint_u = True
    spline.order_u = 4
    o = bpy.data.objects.new(name, curve)
    o.data.materials.append(material)
    o.visible_shadow = False
    bpy.context.scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # Scanned materials, colours from ChatGPT's concept notes (art-inbox/cuddlecore/notes.md)
    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#ece2cf"), tint_mix=0.85, bump=0.6)
    floor = pbr("floor", "old_wooden_floor_01", 2.5, tint=srgb("#6c4b31"), tint_mix=0.3, rough_add=0.15, bump=0.8)
    beam_wood = pbr("beams", "wood_table_worn", 1.5, tint=srgb("#7a5536"), tint_mix=0.45, rot_z=90)
    worktop = pbr("worktop", "wood_table_worn", 1.2, tint=srgb("#a27648"), tint_mix=0.35)
    oak = pbr("oak", "wood_table_worn", 1.0, tint=srgb("#a57543"), tint_mix=0.35, rot_z=90)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#a8723f"), tint_mix=0.55)
    berry_linen = pbr("berry_linen", "rough_linen", 0.5, tint=srgb("#8b4d5c"), tint_mix=1.0, bump=0.5)
    berry_linen.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.25
    knit = image_mat("knit", os.path.join(CONCEPT, "12-cable-knit-tile-candidate.png"), rough=0.95,
                     tile=0.45, normal_from="knitted_fleece", normal_strength=1.0)
    rug_mat = image_mat("rug", os.path.join(CONCEPT, "13-rag-rug-tile-candidate.png"), rough=0.97,
                        tile=0.7, normal_from="knitted_fleece", normal_strength=0.8)

    paint = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    enamel = mat("enamel", srgb("#e9dfc9"), rough=0.3, coat=0.6)
    cast_iron = mat("cast_iron", srgb("#24211c"), rough=0.7, metal=0.75)
    brass = mat("brass", srgb("#9d7b3c"), rough=0.42, metal=1.0)
    chrome = mat("chrome", srgb("#c9c6bf"), rough=0.25, metal=1.0)
    glass = mat("glass", (0.96, 0.98, 0.97, 1), rough=0.03, transmission=1.0, ior=1.5)
    berry_glaze = mat("berry_glaze", srgb("#8b4d5c"), rough=0.3, coat=0.4)
    stoneware = mat("stoneware", srgb("#d9cbb0"), rough=0.45)
    cork = mat("cork", srgb("#a7895e"), rough=0.9)
    beeswax = mat("beeswax", srgb("#e7c779"), rough=0.5)
    beeswax.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.6
    flame = mat("flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.55, 0.2, 1), strength=30)
    card = mat("card", srgb("#efe6d2"), rough=0.9)
    book_colours = ["#6e3b3b", "#3f5543", "#8b6b3e", "#2f3e4f", "#7d4a5a", "#a08155", "#4d3a2a", "#c2a878", "#5b5048"]

    window = window_glass("window_glass", wet=WX["wet"])

    # ---- Shell
    floor_obj = box("floor", (0, 0, -0.05), (W, D, 0.1), floor, bevel=0)
    box("ceiling", (0, 0, H + 0.05), (W, D, 0.1), plaster, bevel=0)
    box("wall_left", (-HX - 0.05, 0, H / 2), (0.1, D, H), plaster, bevel=0)
    box("wall_right", (HX + 0.05, 0, H / 2), (0.1, D, H), plaster, bevel=0)
    box("wall_back", (0, -HY - 0.05, H / 2), (W, 0.1, H), plaster, bevel=0)
    win_l, win_r, win_b, win_t = -0.775, 0.775, 1.05, 2.42     # concept: 1.55 x 1.4 m, sill at ~1.05 m
    box("wall_front_l", ((-HX + win_l) / 2, HY + 0.15, H / 2), (win_l + HX, 0.3, H), plaster, bevel=0)
    box("wall_front_r", ((HX + win_r) / 2, HY + 0.15, H / 2), (HX - win_r, 0.3, H), plaster, bevel=0)
    box("wall_front_b", (0, HY + 0.15, win_b / 2), (win_r - win_l, 0.3, win_b), plaster, bevel=0)
    box("wall_front_t", (0, HY + 0.15, (H + win_t) / 2), (win_r - win_l, 0.3, H - win_t), plaster, bevel=0)
    for x in (-1.5, 0, 1.5):
        box(f"beam_{x}", (x, 0, H - 0.1), (0.2, D, 0.2), beam_wood, bevel=0.015)
    for name, loc, size in (("skirt_l", (-HX + 0.01, 0, 0.08), (0.02, D, 0.16)),
                            ("skirt_r", (HX - 0.01, 0, 0.08), (0.02, D, 0.16)),
                            ("skirt_b", (0, -HY + 0.01, 0.08), (W, 0.02, 0.16)),
                            ("skirt_f", (0, HY - 0.01, 0.08), (W, 0.02, 0.16))):
        box(name, loc, size, paint, bevel=0.003)

    # ---- Front wall: six-pane sash window, berry curtains, vintage range, cast-iron pot
    wy = HY + 0.2
    zc = (win_b + win_t) / 2
    box("sill", (0, HY - 0.04, win_b - 0.025), (win_r - win_l + 0.2, 0.3, 0.05), worktop, bevel=0.006)
    for side, x in (("l", win_l + 0.03), ("r", win_r - 0.03)):
        box(f"frame_{side}", (x, wy, zc), (0.06, 0.08, win_t - win_b), paint)
    box("frame_t", (0, wy, win_t - 0.03), (win_r - win_l, 0.08, 0.06), paint)
    box("frame_b", (0, wy, win_b + 0.03), (win_r - win_l, 0.08, 0.06), paint)
    box("meeting_rail", (0, wy, zc), (win_r - win_l, 0.07, 0.05), paint)
    for x in (-0.258, 0.258):
        box(f"muntin_{x}", (x, wy, zc), (0.025, 0.05, win_t - win_b), paint)
    pane = box("glass", (0, wy + 0.01, zc), (win_r - win_l, 0.006, win_t - win_b), window, bevel=0)
    pane.visible_shadow = False                      # let sun and sky light through the pane

    # The view outside: ChatGPT's backdrop for this weather, emissive, horizon at eye height
    bd_w, bd_h, bd_y = 11.4, 3.8, HY + 4.2
    bd_top = EYE + 0.58 * bd_h                        # the horizon sits 58% down the image
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, bd_y, bd_top - bd_h / 2), rotation=(math.radians(90), 0, 0))
    backdrop = bpy.context.active_object
    backdrop.name = "window_view"
    backdrop.scale = (bd_w, bd_h, 1)
    bpy.ops.object.transform_apply(scale=True)
    backdrop.visible_shadow = False
    backdrop.data.materials.append(emission_mat("window_view", os.path.join(CONCEPT, WX["view"]), WX["backdrop"],
                                                saturation=WX.get("view_sat", VIEW_SAT)))
    hotspot("window", "The rain", None, pane, kind="ambient")
    box("curtain_rod", (0, HY - 0.12, win_t + 0.1), (2.3, 0.022, 0.022), cast_iron, bevel=0.009)
    curtain("curtain_l", win_l - 0.18, HY - 0.12, win_t + 0.08, 0.5, win_t - win_b + 0.32, berry_linen, seed=1)
    curtain("curtain_r", win_r + 0.18, HY - 0.12, win_t + 0.08, 0.5, win_t - win_b + 0.32, berry_linen, seed=2)

    ry = HY - 0.36                                   # range: 1.0 w x 0.7 d x 0.9 h, against the wall
    front = ry - 0.35
    box("range_plinth", (0, ry + 0.03, 0.04), (0.96, 0.62, 0.08), cast_iron, bevel=0.005)
    box("range_body", (0, ry, 0.49), (1.0, 0.7, 0.82), enamel, bevel=0.035)
    box("range_top", (0, ry + 0.01, 0.92), (1.03, 0.72, 0.04), cast_iron, bevel=0.008)
    cyl("hotplate_r", (0.24, ry + 0.02, 0.945), 0.16, 0.012, cast_iron, bevel=0.003)
    cyl("towel_rail", (0, front - 0.06, 0.86), 0.012, 1.0, brass, rot=(0, math.radians(90), 0))
    for x in (-0.48, 0.48):
        box(f"rail_bracket_{x}", (x, front - 0.03, 0.86), (0.02, 0.06, 0.02), brass, bevel=0.004)
    for col, x in (("l", -0.24), ("r", 0.24)):
        for row, (z, h) in (("t", (0.62, 0.3)), ("b", (0.25, 0.3))):
            box(f"oven_{col}{row}", (x, front - 0.008, z), (0.42, 0.02, h), enamel, bevel=0.018)
            box(f"latch_{col}{row}", (x + (0.15 if col == "l" else -0.15), front - 0.025, z), (0.06, 0.02, 0.025), chrome, bevel=0.005)
            for dz in (-h / 3, h / 3):
                cyl(f"hinge_{col}{row}{dz}", (x + (-0.2 if col == "l" else 0.2), front - 0.02, z + dz), 0.012, 0.05, chrome)
    box("tea_towel", (0.18, front - 0.07, 0.72), (0.2, 0.01, 0.3), card, bevel=0.003)

    pot = model("pot_enamel_01", (0.24, ry + 0.02, 0.952), rot_z=8, scale=1.25)
    swap_material(pot, cast_iron)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(0.24, ry, 1.42))
    steam = bpy.context.active_object
    steam.name = "steam"
    steam.scale = (0.8, 0.8, 1.6)
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
    grad = snt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    unit = snt.nodes.new("ShaderNodeVectorMath")      # the mesh has radius 0.2: scale to 1 so the puff fades
    unit.operation = "SCALE"                          # out before its edge instead of ending in a hard shell
    unit.inputs["Scale"].default_value = 5.0
    snt.links.new(stc.outputs["Object"], unit.inputs[0])
    snt.links.new(unit.outputs[0], grad.inputs["Vector"])
    mul = snt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    snt.links.new(snz.outputs["Fac"], mul.inputs[0])
    snt.links.new(grad.outputs["Fac"], mul.inputs[1])
    dens = snt.nodes.new("ShaderNodeMapRange")
    dens.inputs["From Min"].default_value = 0.2
    dens.inputs["To Max"].default_value = 3.0
    snt.links.new(mul.outputs[0], dens.inputs["Value"])
    snt.links.new(dens.outputs["Result"], vol.inputs["Density"])
    snt.links.new(vol.outputs["Volume"], snt.nodes["Material Output"].inputs["Volume"])
    steam.data.materials.append(sm)
    hotspot("cauldron", "Find Comfort", None, pot, kind="submit")

    # Front-right: small cupboard with the brass lamp and a bowl of produce; map above
    side = model("painted_wooden_cabinet", (1.2, HY - 0.33, 0), rot_z=0)
    top = 1.18
    lamp = model("vintage_oil_lamp", (1.55, HY - 0.3, top), scale=0.65)
    for o in meshes_of(lamp):
        if o.name.endswith("flame"):
            o.data.materials.clear()
            o.data.materials.append(flame if WX["flames"] else beeswax)
    if WX["flames"]:
        point_light("lamp_light", (1.55, HY - 0.3, top + 0.36), 22 * WX["flames"], (1.0, 0.64, 0.33), radius=0.03)
    hotspot("oil-lamp", "The lamp", None, lamp, kind="ambient")
    bowl = model("wooden_bowl_01", (1.0, HY - 0.33, top))
    for i, (dx, dy) in enumerate(((-0.05, 0.0), (0.05, 0.03), (0.0, -0.06))):
        model("food_apple_01", (1.0 + dx, HY - 0.33 + dy, top + 0.02), rot_z=i * 70)
    model("yellow_onion", (1.04, HY - 0.37, top + 0.03), rot_z=40)
    hotspot("bowl", "The bowl", None, bowl, kind="ambient")
    m = wall_picture("map", os.path.join(CONCEPT, "10-coastal-map-flat.png"), (1.5, HY - 0.004, 1.82), (0.36, 0.36), "-y")
    for dx in (-0.16, 0.16):
        cyl(f"map_pin_{dx}", (1.5 + dx, HY - 0.008, 1.98), 0.006, 0.008, brass, rot=(math.radians(90), 0, 0))
    hotspot("locale-map", "Location", "locale", m)

    # Barometer on the front wall: turning it changes the weather (and the room's light)
    from mathutils import Matrix, Euler
    bx_, bz_, face_y = -1.5, 1.62, HY - 0.05
    cyl("baro_case", (bx_, HY - 0.025, bz_), 0.15, 0.05, oak, bevel=0.012, rot=(math.radians(90), 0, 0))
    box("baro_neck", (bx_, HY - 0.025, bz_ + 0.27), (0.11, 0.045, 0.34), oak, bevel=0.012)
    cyl("baro_finial", (bx_, HY - 0.025, bz_ + 0.46), 0.055, 0.045, oak, bevel=0.01, rot=(math.radians(90), 0, 0))
    cyl("baro_hygro_face", (bx_, face_y + 0.002, bz_ + 0.46), 0.04, 0.004, card, rot=(math.radians(90), 0, 0))
    cyl("baro_face", (bx_, face_y, bz_), 0.122, 0.004, card, rot=(math.radians(90), 0, 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.124, minor_radius=0.008, location=(bx_, face_y - 0.002, bz_),
                                     rotation=(math.radians(90), 0, 0))
    bpy.context.active_object.data.materials.append(brass)
    ink = mat("ink", srgb("#2c2416"), rough=0.6)

    def on_face(angle_deg, radius, dy=0.0):
        a = math.radians(angle_deg)
        loc = (bx_ + radius * math.sin(a), face_y - 0.003 - dy, bz_ + radius * math.cos(a))
        rot = (Matrix.Rotation(a, 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "X")).to_euler()
        return loc, rot

    for word, ang in (("STORMY", -60), ("RAIN", -30), ("CHANGE", 0), ("FAIR", 30), ("VERY DRY", 60)):
        curve = bpy.data.curves.new(f"baro_{word}", "FONT")
        curve.body, curve.align_x, curve.align_y, curve.size = word, "CENTER", "CENTER", 0.016
        t = bpy.data.objects.new(f"baro_{word}", curve)
        t.location, t.rotation_euler = on_face(ang, 0.088)
        t.data.materials.append(ink)
        scene.collection.objects.link(t)
        tick, trot = on_face(ang, 0.108)
        tk = box(f"baro_tick_{word}", tick, (0.002, 0.002, 0.012), ink, bevel=0)
        tk.rotation_euler = trot
    needle_loc, needle_rot = on_face(WX["dial"], 0.045, dy=0.004)
    needle = box("baro_needle", needle_loc, (0.004, 0.002, 0.095), cast_iron, bevel=0)
    needle.rotation_euler = needle_rot
    cyl("baro_pin", (bx_, face_y - 0.008, bz_), 0.008, 0.006, brass, rot=(math.radians(90), 0, 0))
    hotspot("barometer", "The weather", "weather", [needle], kind="weather")

    # Front-left floor: basket beside the range; plant in the corner
    basket = model("wicker_basket_02", (-0.82, HY - 0.3, 0), rot_z=20, scale=1.6)
    hotspot("basket", "The basket", None, basket, kind="ambient")
    plant = model("potted_plant_02", (-1.85, HY - 0.42, 0), rot_z=20, scale=0.9)
    hotspot("plant", "The plant", None, plant, kind="ambient")

    # ---- Left wall: cream cabinet with butcher-block top, two oak shelves of six jars, three candles
    cx, cy, clen = -HX + 0.31, 0.6, 1.8
    box("left_cab", (cx, cy, 0.44), (0.62, clen, 0.88), paint, bevel=0.012)
    for i, y in enumerate((cy - 0.6, cy, cy + 0.6)):
        box(f"left_cab_door_{i}", (cx + 0.315, y, 0.46), (0.02, 0.56, 0.7), paint, bevel=0.01)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=(cx + 0.335, y + 0.2, 0.62))
        bpy.context.active_object.data.materials.append(brass)
    box("left_top", (cx + 0.01, cy, 0.905), (0.66, clen + 0.04, 0.05), worktop, bevel=0.01)
    shelf_objs = []
    for z in (1.42, 1.82):
        shelf_objs.append(box(f"jar_shelf_{z}", (-HX + 0.13, cy, z), (0.26, 1.3, 0.04), oak, bevel=0.006))
        for y in (cy - 0.55, cy + 0.55):
            box(f"bracket_{z}_{y}", (-HX + 0.07, y, z - 0.08), (0.13, 0.035, 0.13), oak, bevel=0.004)
    jar_specs = [  # (shelf z, y, radius, height, contents colour or None for the berry honey jar)
        (1.82, cy - 0.35, 0.075, 0.22, "#d8c9a3"),   # oats
        (1.82, cy + 0.35, 0.075, 0.2, "#6f7a3c"),    # dried herbs
        (1.42, cy - 0.45, 0.07, 0.17, None),         # honey, berry glaze
        (1.42, cy - 0.15, 0.072, 0.21, "#c8642a"),   # lentils
        (1.42, cy + 0.15, 0.072, 0.21, "#c9a35b"),   # dried ginger
        (1.42, cy + 0.45, 0.072, 0.21, "#d9b13a"),   # yellow pulses
    ]
    jars = []
    for i, (z, y, r, h, colour) in enumerate(jar_specs):
        z0 = z + 0.02
        if colour is None:
            jars.append(cyl(f"jar_{i}", (-HX + 0.13, y, z0 + h / 2), r, h, berry_glaze))
        else:
            jars.append(cyl(f"jar_{i}", (-HX + 0.13, y, z0 + h / 2), r, h, glass, bevel=0.01))
            fill = mat(f"fill_{i}", srgb(colour), rough=0.9)
            cyl(f"jar_fill_{i}", (-HX + 0.13, y, z0 + h * 0.37), r * 0.9, h * 0.7, fill, bevel=0)
        cyl(f"lid_{i}", (-HX + 0.13, y, z0 + h + 0.015), r * 0.86, 0.03, cork)
    hotspot("symptom-jars", "How you're feeling", "symptoms", jars + shelf_objs)

    energy_candles(-HX + 0.4, 0.93, cast_iron)
    model("jug_01", (-HX + 0.38, 0.62, 0.93), rot_z=100)
    board = model("wooden_cutting_board", (-HX + 0.4, 1.02, 0.93), rot_z=95)
    hotspot("cutting-board", "Chopping board", None, board, kind="ambient")
    model("lemon", (-HX + 0.42, 1.25, 0.975), rot_z=30)
    model("potted_plant_02", (-HX + 0.32, 1.38, 0.93), rot_z=60, scale=0.3)   # herb pot

    # ---- Right wall: the pantry (a cream dresser, open shelves stocked), cookbook shelves over a cabinet
    px, py, ps = HX - 0.3, 0.92, 0.9
    pantry = model("painted_wooden_cabinet_02", (px, py, 0), rot_z=-90, scale=ps)
    retint(pantry, "#eee5d3")
    bpy.context.view_layer.update()
    sx = px + 0.1                                   # the upper shelves are set back from the counter edge
    shelves = sorted(z for z in shelf_heights(pantry, sx, py, 2.6) if 0.9 < z < 2.1)
    stock = [
        lambda z: [model("food_apple_01", (sx, py + dy, z), rot_z=dy * 300) for dy in (-0.25, -0.15, -0.05)]
        + [model("lemon", (sx, py + 0.08, z + 0.045)), model("yellow_onion", (sx, py + 0.2, z))],
        lambda z: [model("wicker_basket_02", (sx, py - 0.15, z), rot_z=10),
                   model("jug_01", (sx, py + 0.17, z), rot_z=200)],
        lambda z: [cyl(f"bowl_stack_{z}_{k}", (sx, py - 0.1, z + 0.025 + k * 0.045), 0.11 - k * 0.012, 0.045, stoneware, bevel=0.01) for k in range(3)]
        + [cyl(f"beans_jar_{z}", (sx, py + 0.17, z + 0.11), 0.065, 0.22, glass, bevel=0.01),
           cyl(f"beans_{z}", (sx, py + 0.17, z + 0.08), 0.058, 0.15, mat("beans", srgb("#efe8da"), rough=0.7), bevel=0)],
        lambda z: [model("ceramic_vase_01", (sx, py, z), scale=0.5)],
    ]
    for i, z in enumerate(shelves[:len(stock)]):
        stock[i](z)
    point_light("pantry_glow", (px - 0.25, py, 1.7), 6, (1.0, 0.7, 0.42), radius=0.15)
    hotspot("pantry-cabinet", "Your pantry", "pantry", pantry)

    bx, by, blen = HX - 0.31, -0.55, 1.3
    box("right_cab", (bx, by, 0.44), (0.62, blen, 0.88), paint, bevel=0.012)
    for i, y in enumerate((by - 0.32, by + 0.32)):
        box(f"right_cab_door_{i}", (bx - 0.315, y, 0.46), (0.02, 0.6, 0.7), paint, bevel=0.01)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=(bx - 0.335, y + (0.22 if i == 0 else -0.22), 0.62))
        bpy.context.active_object.data.materials.append(brass)
    box("right_top", (bx - 0.01, by, 0.905), (0.66, blen + 0.04, 0.05), worktop, bevel=0.01)
    book_shelf = []
    for z in (1.5, 1.92):
        book_shelf.append(box(f"book_shelf_{z}", (HX - 0.13, by, z), (0.26, 1.2, 0.04), oak, bevel=0.006))
        for y in (by - 0.5, by + 0.5):
            box(f"bk_bracket_{z}_{y}", (HX - 0.07, y, z - 0.08), (0.13, 0.035, 0.13), oak, bevel=0.004)
    y = by - 0.52
    for bi in range(11):
        t = 0.03 + (bi * 7 % 5) * 0.007
        hb = 0.21 + (bi * 3 % 5) * 0.022
        colour = mat(f"book_{bi}", srgb(book_colours[bi % len(book_colours)]), rough=0.8)
        b = box(f"book_{bi}", (HX - 0.14, y + t / 2, 1.52 + hb / 2), (0.19, t, hb), colour, bevel=0.003)
        b.rotation_euler = (math.radians(7) if bi == 10 else 0, 0, 0)
        book_shelf.append(b)
        y += t + 0.004
    box("card_box", (HX - 0.14, by + 0.3, 1.565), (0.12, 0.16, 0.09), oak, bevel=0.004)
    box("cards", (HX - 0.14, by + 0.3, 1.615), (0.1, 0.14, 0.04), card, bevel=0.002)
    model("jug_01", (HX - 0.13, by + 0.05, 1.94), rot_z=180, scale=0.9)
    for k in range(2):
        cyl(f"shelf_bowl_{k}", (HX - 0.13, by - 0.35, 1.965 + k * 0.04), 0.1 - k * 0.012, 0.04, stoneware, bevel=0.01)
    model("potted_plant_02", (HX - 0.15, by + 0.38, 1.94), rot_z=10, scale=0.28)
    hotspot("dietary-shelf", "Dietary needs", "dietary", book_shelf)

    # Your kitchen: a microwave and an air fryer on the bare right-hand worktop, under the cookbook shelves (front toward the room)
    am = appliance_mats()
    mw = APPLIANCES["microwave"](am, (HX - 0.28, by + 0.25, 0.93), rot_z=90, name="app_microwave")
    hotspot("microwave", "The microwave", None, mw, kind="kitchen", appliance="microwave")
    af = APPLIANCES["air-fryer"](am, (HX - 0.27, by - 0.38, 0.93), rot_z=90, name="app_air_fryer")
    hotspot("air-fryer", "The air fryer", None, af, kind="kitchen", appliance="air-fryer")
    # the kettle on the left hotplate (where the cover used to sit), spout toward the room a little
    kt = APPLIANCES["kettle"](am, (-0.24, ry + 0.02, 0.94), rot_z=-20, name="app_kettle")
    hotspot("kettle", "The kettle", None, kt, kind="kitchen", appliance="kettle")

    # a little table beside the armchair (between it and the right wall, clear of the throw and Erwina's seat), with a cup and a glass
    tm = tool_mats()
    tbl = model("side_table_01", (1.9, -1.85, 0), rot_z=10, scale=0.8)
    tbl.scale = (0.9, 0.9, 1.0)
    retint(tbl, "#c9a57a", lo=0.6, hi=1.2)
    bpy.context.view_layer.update()
    tpts = [o.matrix_world @ Vector(c) for o in meshes_of(tbl) for c in o.bound_box]
    ttop = max(p.z for p in tpts)
    print("[whisked] little table top", round(ttop, 3), "x", round(min(p.x for p in tpts), 2), round(max(p.x for p in tpts), 2),
          "y", round(min(p.y for p in tpts), 2), round(max(p.y for p in tpts), 2))
    cup = cup_and_saucer(tm, (1.86, -1.86, ttop), rot_z=200, name="app_cup")
    gl = water_glass(tm, (2.0, -1.78, ttop), name="app_glass")
    hotspot("little-table", "The little table", None, meshes_of(tbl) + meshes_of(cup) + meshes_of(gl), kind="ambient")

    # teaching tools on the left wall, behind the candles' end: a peg rail with measuring cups and wooden spoons, a shelf with a timer
    wx = -HX
    box("tool_rail", (wx + 0.015, -1.3, 1.58), (0.03, 1.5, 0.06), oak, bevel=0.006)
    for y in (-1.75, -0.85):
        cyl(f"tool_peg_{y}", (wx + 0.055, y, 1.58), 0.011, 0.05, oak, rot=(0, math.radians(90), 0))
    mc = TOOLS["measuring-cups"](tm, (wx + 0.075, -1.75, 1.6), rot_z=-90, name="app_measuring_cups")
    mc.scale = (1.5, 1.5, 1.5)           # the wall is a long way from the camera
    hotspot("measuring-cups", "The measuring cups", None, meshes_of(mc), kind="ambient")
    sp = TOOLS["spoons"](tm, (wx + 0.075, -0.85, 1.6), rot_z=-90, name="app_spoons")
    sp.scale = (1.3, 1.3, 1.3)
    hotspot("wooden-spoons", "The wooden spoons", None, meshes_of(sp), kind="ambient")
    sh = box("tool_shelf", (wx + 0.1, -1.3, 1.1), (0.2, 0.46, 0.03), oak, bevel=0.006)
    for y in (-1.46, -1.14):
        box(f"tool_shelf_bracket_{y}", (wx + 0.04, y, 1.04), (0.07, 0.03, 0.1), oak, bevel=0.004)
    tmr = TOOLS["timer"](tm, (wx + 0.11, -1.3, 1.115), rot_z=-90, name="app_timer")
    tmr.scale = (1.4, 1.4, 1.4)
    bpy.context.view_layer.update()
    hotspot("timer", "The timer", None, meshes_of(tmr), kind="ambient")

    # ---- Back wall: cream armchair with a knitted berry throw, rag rug, botanical print, oak door
    door = box("door", (-0.95, -HY + 0.035, 1.025), (0.9, 0.05, 2.05), door_oak, bevel=0.01)
    for dz in (-0.55, 0.0, 0.55):
        box(f"ledge_{dz}", (-0.95, -HY + 0.065, 1.025 + dz), (0.84, 0.015, 0.1), door_oak, bevel=0.004)
    box("door_trim_t", (-0.95, -HY + 0.03, 2.09), (1.06, 0.06, 0.09), paint, bevel=0.006)
    for x in (-1.44, -0.46):
        box(f"door_trim_{x}", (x, -HY + 0.03, 1.04), (0.08, 0.06, 2.1), paint, bevel=0.006)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(-0.6, -HY + 0.1, 1.0))
    bpy.context.active_object.data.materials.append(brass)
    hotspot("exit-door", "Back to the inn", None, door, kind="door")

    # Wall clock above the door. Position from the room data shared with the browser; no hands here,
    # because the viewer draws them live to show whatever time the visitor has set.
    world = json.load(open(os.path.join(HERE, "explore", "cuddlecore-world.json"), encoding="utf8"))
    cfx = world["fixtures"]["clock"]
    ccx, ccy, ccz = cfx["center"]
    R = cfx["radius"]
    rot_face = (math.radians(90), 0, 0)
    cyl("clock_case", (ccx, -HY + 0.02, ccz), R + 0.022, 0.04, oak, bevel=0.01, rot=rot_face)
    fy = -HY + 0.042                              # face just proud of the case front
    cyl("clock_face", (ccx, fy, ccz), R, 0.004, card, rot=rot_face)
    bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.004, minor_radius=0.006, location=(ccx, fy + 0.002, ccz),
                                     rotation=rot_face)
    bpy.context.active_object.data.materials.append(brass)
    clock_ink = mat("clock_ink", srgb("#2c2416"), rough=0.6)
    for i in range(12):
        a = math.radians(i * 30)
        long = i % 3 == 0
        tick = box(f"clock_tick_{i}", (ccx - R * 0.84 * math.sin(a), fy + 0.0025, ccz + R * 0.84 * math.cos(a)),
                   (0.004 if not long else 0.007, 0.002, 0.012 if not long else 0.022), clock_ink, bevel=0)
        tick.rotation_euler = (0, -a, 0)          # seen from the room (looking -Y), clockwise from 12
    cyl("clock_pin", (ccx, fy + 0.005, ccz), 0.006, 0.006, brass, rot=rot_face)

    chair = model("ArmChair_01", (0.85, -HY + 0.62, 0), rot_z=180, scale=1.1)
    retint(chair, "#ded1b9", lo=0.6, hi=1.2)
    pillows = model("throw_pillows_01", (0.85, -HY + 0.62, 0.46), rot_z=180, scale=0.5)
    retint(pillows, "#e9dfcc", lo=0.7, hi=1.15)
    hotspot("armchair", "The armchair", None, chair, kind="ambient")
    rug = box("rug", (0.7, -1.25, 0.006), (1.6, 1.1, 0.012), rug_mat, bevel=0.003)
    colliders = meshes_of(chair) + meshes_of(pillows) + [floor_obj, rug]
    berry_knit = pbr("berry_knit", "knitted_fleece", 0.35, tint=srgb("#9a5466"), tint_mix=0.8, bump=1.0)
    # start clear of the chair back (a sheet that begins inside a collider snags), over the arm and seat front
    drape("throw", (1.0, 0.8), 40, (1.22, -1.38, 0.98), (0, 0, math.radians(8)),
          berry_knit, colliders, frames=100)
    art = wall_picture("botanical", os.path.join(CONCEPT, "11-botanical-flat.png"), (0.85, -HY + 0.014, 1.62), (0.48, 0.6), "+y")
    box("botanical_board", (0.85, -HY + 0.006, 1.62), (0.48, 0.012, 0.6), oak, bevel=0.002)

    # ---- Lighting: rainy sky through the window, warm candles and lamp
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
    tint = wnt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
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
        # shine in through the front window: from +Y (outside), down and slightly across
        d = Vector((math.sin(math.radians(azim)), -math.cos(math.radians(azim)), -math.tan(math.radians(elev)))).normalized()
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(so)

    area_light("window_portal", (0, wy, zc), (math.radians(90), 0, 0), (win_r - win_l, win_t - win_b), 0, (1, 1, 1), portal=True)
    bounce = area_light("window_bounce", (0, HY - 0.05, zc), (math.radians(90), 0, 0), (1.5, 1.3), WX["bounce"][0], WX["bounce"][1])
    bounce.visible_camera = False                    # light the room, but don't hang a white sheet over the view
    bounce.visible_glossy = False
    point_light("warm_fill", (0.3, -0.4, 2.3), WX["fill"], (1.0, 0.68, 0.4), radius=0.8)

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
    scene.view_settings.exposure = WX["exposure"]
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def flythrough(scene):
    """Shots 6 and 7: in from the kitchen door, across the rug, up to the steaming pot."""
    sys.path.insert(0, HERE)
    from whisked import fly_camera, video_settings
    rough = "--rough" in ARGS
    fly_camera(scene, [
        (1,   (-0.95, -1.9, 1.6), (0, 2.2, 1.0), 28),    # 6: just inside the door
        (168, (0.1, 0.9, 1.5), (0.1, 2.2, 1.0), 28),     #    across the rug, past the armchair
        (264, (0.15, 0.95, 1.62), (0.24, HY - 0.34, 1.2), 35),   # 7: the pot and its steam, and hold
    ])
    out = os.path.join(OUT, "flythrough", "rough" if rough else "final", "kitchen_")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    video_settings(scene, rough, out)
    bpy.ops.render.render(animation=True)
    print("[whisked] fly-through frames done")


def main():
    build()
    if "--flythrough" in ARGS:
        return flythrough(bpy.context.scene)
    suffix = "_preview" if PREVIEW else ""
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "cuddlecore.blend"))
    with open(os.path.join(OUT, "cuddlecore_hotspots.json"), "w") as fh:
        json.dump(HOTSPOTS, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)", json.dumps(HOTSPOTS))
        return
    bpy.context.scene.render.filepath = os.path.join(OUT, f"cuddlecore_pano_{WEATHER}{'_night' if NIGHT else ''}{suffix}.jpg")
    bpy.ops.render.render(write_still=True)
    print("[whisked] done", json.dumps(HOTSPOTS))


main()
