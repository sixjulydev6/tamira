"""Tamira tower room: the furnished corner room on floor 19 that the single wire lights.

Same conventions as art/blender/skyline/build_skyline.py:
    three.js (x, y, z)  ->  Blender (x, -z, y)      metres, Y-up on the web, Z-up here
    room bounds, floor 19 (y 118.8, 3.6 m storey), riser [79, 31.4], the ceiling wire path and the
    two light positions all come from src/story/skyline/layout.js + building.js, so the room drops
    into the tower and onto the wire without moving anything.

The layout follows building.js buildRoom() (living by the corner glass, dining by the inner corner,
sideboard/art on the x0 wall, shelving on the z0 wall, two plants) but as modelled furniture.
Keep the ceiling clear along the wire: riser (79, 31.4) -> (86.5, 31.4) -> (86.5, 39.2) -> (84.5, 39.2)
at y 121.98, 0.12 m under the ceiling.

Material names carry a class before the first underscore (wood_, fabric_, leather_, metal_, plaster_,
concrete_, glass_, ceramic_, paper_, art_, leaf_, bark_, soil_, light_). Groups (collections ROOM_<g>):
shell, facade, entry (glass the camera passes through), furniture, decor, plants, curtain, lights, rig.

Run in a live Blender (MCP) with the file contents, then build().  Deterministic: all randomness is seeded.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

SCENE_NAME = "TAMIRA_room"

# ----------------------------------------------------------------------------- layout (layout.js)
X0, X1, Z0, Z1 = 78.6, 90.4, 31.0, 47.4     # ROOM (XM..IN.x1, ZM..IN.z1)
FH = 3.6
YB = 50.4 + 19 * FH                          # floor 19 finished floor, 118.8
YC = YB + FH - 0.3                           # ceiling underside, 122.1
WIRE_Y = YB + FH - 0.42                      # ceilY(19), 121.98
RISER = (79.0, 31.4)
WIRE = [(79.0, 31.4), (86.5, 31.4), (86.5, 39.2), (84.5, 39.2)]
LIGHT_MAIN = (84.5, 39.2)                    # ROOM_LIGHTS[0]: the light the wire feeds
PENDANT = (82.0, YB + 2.35, 35.8)            # ROOM_LIGHTS[1]
DOOR = (80.0, 81.1)                          # door in the z0 partition
# recessed wall-wash downlights, kept off the wire path (riser -> x 86.5 -> z 39.2)
DOWNLIGHTS = [(79.5, 34.6), (79.5, 39.5), (79.5, 44.4), (82.8, 43.6), (88.6, 42.4), (88.6, 46.0), (84.6, 33.0)]

# Modelled furniture (Poliigon Replica sofa / armchair / table), prepared by prepare_furniture.py into
# room_furniture_kit.blend: one object per (piece, room material), origin at the footprint centre on the
# floor, front facing three.js +Z. None keeps the procedural living-room furniture.
FURN_KIT = None
# piece, x, z, yaw (three.js, about +Y): sofa back to the +z glass; table 0.45 m in front; chairs face it
KIT_LAYOUT = [
    ("sofa", 85.6, 45.84, math.pi),
    ("table", 85.6, 44.55, 0.0),
    ("armchair", 84.95, 43.4, 0.3),
    ("armchair", 86.25, 43.4, -0.3),
]


def T(x, y, z):
    """three.js world -> Blender world"""
    return Vector((x, -z, y))


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# ----------------------------------------------------------------------------- materials
# name: (base rgb (linear), metallic, roughness, extra)
MATS = {
    "concrete_slab":   (lin("#8f8d88"), 0.0, 0.85, {}),
    "plaster_wall":    (lin("#ece6dc"), 0.0, 0.88, {}),
    "plaster_ceiling": (lin("#e9e5de"), 0.0, 0.92, {}),
    "paint_skirting":  (lin("#f2eee8"), 0.0, 0.55, {}),
    "wood_oak":        (lin("#b48a62"), 0.0, 0.55, {}),
    "wood_oakwarm":    (lin("#a77b55"), 0.0, 0.58, {}),
    "wood_oakpale":    (lin("#bf9871"), 0.0, 0.52, {}),
    "wood_gap":        (lin("#3a2b20"), 0.0, 0.90, {}),
    "wood_walnut":     (lin("#5b3f2c"), 0.0, 0.45, {}),
    "wood_door":       (lin("#d9d2c6"), 0.0, 0.50, {}),
    "frame_dark":      (lin("#2b2d31"), 0.0, 0.45, {}),
    "metal_mullion":   (lin("#4a4f57"), 0.9, 0.35, {}),
    "metal_black":     (lin("#1c1c1e"), 0.8, 0.40, {}),
    "metal_brass":     (lin("#b8904f"), 1.0, 0.30, {}),
    "metal_service":   (lin("#80858d"), 0.9, 0.45, {}),
    "metal_white":     (lin("#f0efeb"), 0.0, 0.40, {}),
    "glass_facade":    ((0.80, 0.86, 0.88), 0.0, 0.02, {"glass": True}),
    "fabric_sofa":     (lin("#3e4958"), 0.0, 0.92, {"sheen": 0.6}),
    "fabric_cushion":  (lin("#d9cdb8"), 0.0, 0.95, {"sheen": 0.5}),
    "fabric_ochre":    (lin("#b9893f"), 0.0, 0.95, {"sheen": 0.5}),
    "fabric_dining":   (lin("#2f3034"), 0.0, 0.90, {"sheen": 0.4}),
    "fabric_rug":      (lin("#8b806f"), 0.0, 0.98, {"sheen": 0.3}),
    "fabric_rugdark":  (lin("#4a4038"), 0.0, 0.98, {"sheen": 0.3}),
    "fabric_curtain":  (lin("#efe6d8"), 0.0, 0.95, {"sheen": 0.4, "translucent": 0.55}),
    "fabric_shade":    (lin("#f4e7d0"), 0.0, 0.90, {"emit": (lin("#ffcb8a"), 2.5)}),
    "leather_tan":     (lin("#8b6a4f"), 0.0, 0.55, {}),
    "ceramic_white":   (lin("#e8e2d6"), 0.0, 0.35, {}),
    "ceramic_stone":   (lin("#c9bba5"), 0.0, 0.70, {}),
    "ceramic_dark":    (lin("#3b3833"), 0.0, 0.40, {}),
    "soil_pot":        (lin("#2b2119"), 0.0, 0.95, {}),
    "leaf_deep":       (lin("#3f6b3c"), 0.0, 0.60, {"sss": 0.15}),
    "leaf_fresh":      (lin("#4f8046"), 0.0, 0.60, {"sss": 0.15}),
    "bark_stem":       (lin("#5a4636"), 0.0, 0.85, {}),
    "art_terracotta":  (lin("#c46f4a"), 0.0, 0.85, {}),
    "art_teal":        (lin("#2f5d6b"), 0.0, 0.85, {}),
    "art_cream":       (lin("#e7dccb"), 0.0, 0.85, {}),
    "art_charcoal":    (lin("#2e2d2b"), 0.0, 0.85, {}),
    "paper_red":       (lin("#b94a3a"), 0.0, 0.80, {}),
    "paper_cream":     (lin("#e3d2b0"), 0.0, 0.80, {}),
    "paper_navy":      (lin("#2d4a6a"), 0.0, 0.80, {}),
    "paper_grey":      (lin("#3c3c3c"), 0.0, 0.80, {}),
    "paper_ochre":     (lin("#c9a14a"), 0.0, 0.80, {}),
    "light_panel":     ((1.0, 0.95, 0.88), 0.0, 0.50, {"emit": ((1.0, 0.86, 0.68), 12.0)}),
    "light_warm":      ((1.0, 0.92, 0.80), 0.0, 0.50, {"emit": ((1.0, 0.78, 0.52), 14.0)}),
}
BOOKS = ["paper_red", "paper_cream", "paper_navy", "paper_grey", "paper_ochre"]


def make_materials():
    out = {}
    for name, (rgb, met, rough, extra) in MATS.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Metallic"].default_value = met
        bsdf.inputs["Roughness"].default_value = rough
        if extra.get("glass"):
            bsdf.inputs["Transmission Weight"].default_value = 1.0
            bsdf.inputs["IOR"].default_value = 1.5
            try:
                m.surface_render_method = "BLENDED"
            except (AttributeError, TypeError):
                pass
            bsdf.inputs["Alpha"].default_value = 0.18
        if "sheen" in extra:
            bsdf.inputs["Sheen Weight"].default_value = extra["sheen"]
            bsdf.inputs["Sheen Roughness"].default_value = 0.5
        if "sss" in extra:
            bsdf.inputs["Subsurface Weight"].default_value = extra["sss"]
            bsdf.inputs["Subsurface Radius"].default_value = (0.05, 0.04, 0.03)
        if "translucent" in extra:
            # sheer fabric: lit from inside, glows when seen from outside
            nt = m.node_tree
            onode = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
            tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
            tr.inputs["Color"].default_value = (*rgb, 1.0)
            mix = nt.nodes.new("ShaderNodeMixShader")
            mix.inputs["Fac"].default_value = extra["translucent"]
            nt.links.new(bsdf.outputs[0], mix.inputs[1])
            nt.links.new(tr.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], onode.inputs["Surface"])
        if "emit" in extra:
            col, strength = extra["emit"]
            bsdf.inputs["Emission Color"].default_value = (*col, 1.0)
            bsdf.inputs["Emission Strength"].default_value = strength
        m.diffuse_color = (*[min(1, c * 1.4) for c in rgb], 1)
        out[name] = m
    return out


# ----------------------------------------------------------------------------- mesh builder
class Batch:
    """One bmesh per (group, material, bevel). Boxes are axis aligned in three.js coordinates.
    bev = (width, segments) adds a bevel modifier to that batch (soft cushions, eased edges)."""

    def __init__(self):
        self.bms = {}

    def bm(self, group, mat, bev=None):
        k = (group, mat, bev)
        if k not in self.bms:
            self.bms[k] = bmesh.new()
        return self.bms[k]

    def box(self, group, mat, x0, x1, y0, y1, z0, z1, bev=None, faces="all"):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4:
            return
        b = self.bm(group, mat, bev)
        v = [b.verts.new(T(x, y, z)) for x, y, z in (
            (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
            (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1))]
        quads = {"-y": (0, 1, 2, 3), "+y": (4, 7, 6, 5), "-z": (0, 4, 5, 1), "+z": (3, 2, 6, 7),
                 "-x": (0, 3, 7, 4), "+x": (1, 5, 6, 2)}
        for key, q in quads.items():
            if faces != "all" and key not in faces:
                continue
            b.faces.new([v[i] for i in q])

    def cbox(self, group, mat, cx, cy, cz, sx, sy, sz, bev=None):
        """centre/size box (building.js convention)"""
        self.box(group, mat, cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2, bev)

    def cylinder(self, group, mat, cx, cz, r0, y0, y1, r1=None, seg=24, cap=True, bev=None):
        """vertical cylinder / cone frustum (r0 at y0, r1 at y1)"""
        r1 = r0 if r1 is None else r1
        b = self.bm(group, mat, bev)
        angs = [2 * math.pi * i / seg for i in range(seg)]
        ring0 = [b.verts.new(T(cx + r0 * math.cos(a), y0, cz + r0 * math.sin(a))) for a in angs]
        ring1 = [b.verts.new(T(cx + r1 * math.cos(a), y1, cz + r1 * math.sin(a))) for a in angs]
        for i in range(seg):
            j = (i + 1) % seg
            b.faces.new((ring0[i], ring1[i], ring1[j], ring0[j]))
        if cap:
            b.faces.new(ring1[::-1])
            b.faces.new(ring0)

    def poly(self, group, mat, pts):
        b = self.bm(group, mat)
        b.faces.new([b.verts.new(T(*p)) for p in pts])

    def grid(self, group, mat, rows):
        """quad strip surface from rows of three.js points (all rows the same length)"""
        b = self.bm(group, mat)
        vs = [[b.verts.new(T(*p)) for p in row] for row in rows]
        for i in range(len(vs) - 1):
            for j in range(len(vs[i]) - 1):
                b.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))

    def finish(self, mats, collections):
        objs = []
        for (group, mat, bev), b in self.bms.items():
            if not bev:
                bmesh.ops.remove_doubles(b, verts=b.verts, dist=0.0002)
            suffix = f"_b{int(bev[0] * 1000)}" if bev else ""
            me = bpy.data.meshes.new(f"{group}_{mat}{suffix}")
            b.to_mesh(me)
            b.free()
            me.materials.append(mats[mat])
            smooth = bool(bev) or mat.startswith(("fabric_curtain", "leaf_"))
            for p in me.polygons:
                p.use_smooth = smooth
            ob = bpy.data.objects.new(f"{group}__{mat}{suffix}", me)
            collections[group].objects.link(ob)
            if bev:
                md = ob.modifiers.new("bevel", "BEVEL")
                md.width, md.segments = bev
                md.limit_method = "NONE"
                md.profile = 0.5
                md.harden_normals = True
                md.miter_outer = "MITER_ARC"
            objs.append(ob)
        self.bms = {}
        return objs


# ----------------------------------------------------------------------------- shell
def build_shell(B):
    # structural slab under the room and the next slab over it. Both stop 1 cm short of the
    # fascia, floor bed and ceiling plaster: the bundle camera sits inside the upper slab, and
    # coplanar faces there z-fought into a jagged black band (fixed 2026-11-05).
    B.box("shell", "concrete_slab", X0 - 0.2, X1 - 0.01, YB - 0.35, YB - 0.04, Z0 - 0.2, Z1 - 0.01)
    B.box("shell", "concrete_slab", X0 - 0.2, X1 - 0.01, YC + 0.03, YB + FH, Z0 - 0.2, Z1 - 0.01)
    B.box("shell", "plaster_ceiling", X0, X1 - 0.12, YC, YC + 0.02, Z0, Z1 - 0.12)
    # shadow gap where the ceiling meets the glazing
    B.box("shell", "frame_dark", X1 - 0.12, X1, YC + 0.005, YC + 0.02, Z0, Z1)
    B.box("shell", "frame_dark", X0, X1 - 0.12, YC + 0.005, YC + 0.02, Z1 - 0.12, Z1)

    # oak plank floor along z, staggered joints, 4 mm seams over a dark bed
    B.box("shell", "wood_gap", X0, X1, YB - 0.03, YB - 0.012, Z0, Z1)
    r = random.Random(19)
    pw, gap = 0.19, 0.004
    tones = ["wood_oak", "wood_oakwarm", "wood_oakpale"]
    x = X0
    while x < X1 - 1e-3:
        xe = min(x + pw, X1)
        z = Z0 - r.uniform(0, 1.8)
        while z < Z1:
            ln = r.uniform(1.2, 2.4)
            za, zb = max(z, Z0), min(z + ln - gap, Z1)
            if zb - za > 0.05:
                B.box("shell", tones[r.randrange(3)], x, xe - gap, YB - 0.015, YB, za, zb)
            z += ln
        x = xe

    # partitions (inner walls) with skirting; door opening in the z0 wall
    B.box("shell", "plaster_wall", X0 - 0.2, X0, YB, YC, Z0 - 0.2, Z1)
    B.box("shell", "plaster_wall", X0, DOOR[0], YB, YC, Z0 - 0.2, Z0)
    B.box("shell", "plaster_wall", DOOR[1], X1, YB, YC, Z0 - 0.2, Z0)
    B.box("shell", "plaster_wall", DOOR[0], DOOR[1], YB + 2.2, YC, Z0 - 0.2, Z0)
    B.box("shell", "paint_skirting", X0, X0 + 0.015, YB, YB + 0.08, Z0, Z1 - 0.1)
    B.box("shell", "paint_skirting", X0, DOOR[0] - 0.06, YB, YB + 0.08, Z0, Z0 + 0.015)
    B.box("shell", "paint_skirting", DOOR[1] + 0.06, X1 - 0.1, YB, YB + 0.08, Z0, Z0 + 0.015)
    # door: architrave, leaf, lever
    for xa, xb in ((DOOR[0] - 0.06, DOOR[0]), (DOOR[1], DOOR[1] + 0.06)):
        B.box("shell", "paint_skirting", xa, xb, YB, YB + 2.26, Z0, Z0 + 0.02)
    B.box("shell", "paint_skirting", DOOR[0] - 0.06, DOOR[1] + 0.06, YB + 2.2, YB + 2.26, Z0, Z0 + 0.02)
    B.box("shell", "wood_door", DOOR[0] + 0.01, DOOR[1] - 0.01, YB + 0.01, YB + 2.19, Z0 - 0.14, Z0 - 0.1)
    B.box("decor", "metal_black", DOOR[1] - 0.2, DOOR[1] - 0.08, YB + 1.02, YB + 1.04, Z0 - 0.1, Z0 - 0.04, bev=(0.006, 2))

    # riser: the wire comes up through a floor grommet at (79, 31.4), runs up a service channel
    # in the inner corner and out through the ceiling. Nothing in front of it; only a backing plate.
    rx, rz = RISER
    B.box("shell", "metal_service", X0, X0 + 0.02, YB + 0.08, YC, rz - 0.2, rz + 0.25)
    B.box("shell", "metal_service", X0, X0 + 0.04, YB + 0.08, YC, rz - 0.22, rz - 0.2)
    B.box("shell", "metal_service", X0, X0 + 0.04, YB + 0.08, YC, rz + 0.25, rz + 0.27)
    B.cylinder("shell", "metal_service", rx, rz, 0.09, YB, YB + 0.008, seg=20)
    B.cylinder("shell", "metal_service", rx, rz, 0.09, YC - 0.008, YC, seg=20)


def build_facade(B):
    """corner curtain wall on the open +X and +Z faces, mullions on the runtime's 2.7 m rhythm"""
    yh = YC
    # glass (the camera flies through the corner; the runtime hides this group as it enters)
    B.box("entry", "glass_facade", X1 - 0.05, X1 - 0.038, YB + 0.06, yh - 0.04, Z0, Z1 - 0.05)
    B.box("entry", "glass_facade", X0, X1 - 0.05, YB + 0.06, yh - 0.04, Z1 - 0.05, Z1 - 0.038)
    # sill and head channels
    for y0, y1 in ((YB, YB + 0.06), (yh - 0.04, yh)):  # head stops under the shadow-gap trim
        B.box("facade", "metal_mullion", X1 - 0.09, X1, y0, y1, Z0, Z1)
        B.box("facade", "metal_mullion", X0, X1 - 0.09, y0, y1, Z1 - 0.09, Z1)
    # mullions
    z = Z0 + 0.05
    while z <= Z1:
        B.cbox("facade", "metal_mullion", X1 - 0.06, (YB + yh) / 2, z, 0.12, yh - YB, 0.06)
        z += 2.7
    x = X0 + 0.05
    while x <= X1:
        B.cbox("facade", "metal_mullion", x, (YB + yh) / 2, Z1 - 0.06, 0.06, yh - YB, 0.12)
        x += 2.7
    B.box("facade", "metal_mullion", X1 - 0.1, X1, YB, yh, Z1 - 0.1, Z1)
    # slab-edge fascia outside the glass line (dark perforated band in the reference capture)
    for y0, y1 in ((YB - 0.38, YB + 0.0), (YC + 0.02, YB + FH + 0.02)):
        B.box("facade", "frame_dark", X1, X1 + 0.06, y0, y1, Z0 - 0.2, Z1 + 0.06)
        B.box("facade", "frame_dark", X0 - 0.2, X1, y0, y1, Z1, Z1 + 0.06)
    # curtain tracks
    B.box("facade", "metal_white", X1 - 0.36, X1 - 0.3, YC - 0.035, YC - 0.005, Z0 + 0.1, Z1 - 0.3)
    B.box("facade", "metal_white", X0 + 0.1, X1 - 0.3, YC - 0.035, YC - 0.005, Z1 - 0.36, Z1 - 0.3)


# ----------------------------------------------------------------------------- furniture
def build_living(B):
    y = YB
    if FURN_KIT:
        build_living_kit(B)
    else:
        build_living_boxes(B)
    # arc floor lamp in the corner (building.js 88.2, 46.4; glow at +1.64)
    fx, fz = 88.2, 46.4
    B.cylinder("furniture", "metal_black", fx, fz, 0.16, y, y + 0.03, seg=32)
    B.cylinder("furniture", "metal_brass", fx, fz, 0.012, y + 0.03, y + 1.48, seg=12)
    B.cylinder("lights", "fabric_shade", fx, fz, 0.22, y + 1.46, y + 1.8, r1=0.2, seg=32, cap=False)
    B.cylinder("lights", "light_warm", fx, fz, 0.19, y + 1.47, y + 1.48, seg=32)


def build_living_kit(B):
    """rug, side table and table-top objects around the modelled furniture (place_kit adds the pieces)"""
    y = YB
    B.box("decor", "fabric_rug", 83.4, 87.8, y, y + 0.014, 42.4, 46.0, bev=(0.006, 2))
    B.cylinder("furniture", "wood_walnut", 83.75, 45.7, 0.22, y + 0.5, y + 0.53, seg=32)
    B.cylinder("furniture", "metal_black", 83.75, 45.7, 0.018, y + 0.02, y + 0.5, seg=12)
    B.cylinder("furniture", "metal_black", 83.75, 45.7, 0.16, y, y + 0.02, seg=24)
    top = y + 0.363   # Nimbus table top
    B.cylinder("decor", "ceramic_dark", 85.75, 44.52, 0.12, top, top + 0.06, r1=0.14, seg=32)
    B.cylinder("decor", "ceramic_white", 85.42, 44.66, 0.04, top, top + 0.18, r1=0.028, seg=20)
    B.box("decor", "paper_navy", 85.32, 85.56, top, top + 0.03, 44.3, 44.47, bev=(0.003, 1))
    B.box("decor", "paper_cream", 85.34, 85.54, top + 0.03, top + 0.055, 44.32, 44.45, bev=(0.003, 1))


def place_kit(colls, mats):
    """append the prepared furniture and place it per KIT_LAYOUT, recoloured with the room's materials"""
    with bpy.data.libraries.load(FURN_KIT, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith("kit_")]
    pieces = {}
    for ob in dst.objects:
        piece = ob.name.split("__")[0][4:]
        cls = ob.name.split("__")[1].split(".")[0]
        placeholder = ob.data.materials[0] if ob.data.materials else None
        ob.data.materials.clear()
        ob.data.materials.append(mats[cls])
        if placeholder and placeholder.users == 0:
            bpy.data.materials.remove(placeholder)
        pieces.setdefault(piece, []).append((cls, ob))
    out = []
    for i, (piece, x, z, yaw) in enumerate(KIT_LAYOUT):
        for cls, src_ob in pieces[piece]:
            ob = bpy.data.objects.new(f"furniture__kit_{piece}{i}_{cls}", src_ob.data)
            ob.location = T(x, YB, z)
            ob.rotation_euler = (0, 0, yaw)
            colls["furniture"].objects.link(ob)
            out.append(ob)
    for _, obs in pieces.items():
        for _, ob in obs:
            bpy.data.objects.remove(ob)
    return out


def build_living_boxes(B):
    y = YB
    # rug: low pile over a thin underlay
    B.box("decor", "fabric_rug", 83.0, 88.2, y, y + 0.014, 40.4, 44.8, bev=(0.006, 2))

    # L-shaped sofa against the +z glass, chaise to the +x side (building.js 85.6/45.6 + 87.0/44.3)
    sx0, sx1, sz0, sz1 = 83.9, 87.3, 45.05, 46.3
    cz0 = 43.5
    for lx, lz in ((sx0 + 0.08, sz0 + 0.08), (sx0 + 0.08, sz1 - 0.08), (sx1 - 0.08, cz0 + 0.08), (sx1 - 0.08, sz1 - 0.08), (86.2, cz0 + 0.08)):
        B.cbox("furniture", "metal_black", lx, y + 0.05, lz, 0.04, 0.1, 0.04)
    B.box("furniture", "fabric_sofa", sx0, sx1, y + 0.1, y + 0.32, sz0, sz1, bev=(0.03, 3))
    B.box("furniture", "fabric_sofa", 86.12, sx1, y + 0.1, y + 0.32, cz0, sz0 + 0.02, bev=(0.03, 3))
    B.box("furniture", "fabric_sofa", sx0, sx0 + 0.22, y + 0.1, y + 0.62, sz0, sz1, bev=(0.05, 4))
    B.box("furniture", "fabric_sofa", sx1 - 0.22, sx1, y + 0.1, y + 0.62, cz0, sz1, bev=(0.05, 4))
    B.box("furniture", "fabric_sofa", sx0 + 0.22, sx1 - 0.22, y + 0.32, y + 0.8, sz1 - 0.24, sz1, bev=(0.045, 4))
    # seat and back cushions
    for xa, xb in ((sx0 + 0.23, 85.12), (85.14, 86.1)):
        B.box("furniture", "fabric_sofa", xa, xb, y + 0.32, y + 0.48, sz0 + 0.03, sz1 - 0.25, bev=(0.06, 5))
        B.box("furniture", "fabric_sofa", xa + 0.02, xb - 0.02, y + 0.46, y + 0.9, sz1 - 0.5, sz1 - 0.24, bev=(0.08, 5))
    B.box("furniture", "fabric_sofa", 86.12, sx1 - 0.23, y + 0.32, y + 0.48, cz0 + 0.03, sz1 - 0.25, bev=(0.06, 5))
    B.box("furniture", "fabric_sofa", 86.14, sx1 - 0.25, y + 0.46, y + 0.9, sz1 - 0.5, sz1 - 0.24, bev=(0.08, 5))
    # throw pillows
    B.cbox("decor", "fabric_cushion", 84.45, y + 0.7, 45.62, 0.46, 0.44, 0.14, bev=(0.06, 5))
    B.cbox("decor", "fabric_ochre", 85.0, y + 0.66, 45.6, 0.4, 0.38, 0.13, bev=(0.06, 5))
    B.cbox("decor", "fabric_cushion", 86.7, y + 0.7, 45.62, 0.46, 0.44, 0.14, bev=(0.06, 5))
    # folded throw on the chaise
    B.box("decor", "fabric_cushion", 86.3, 87.0, y + 0.48, y + 0.53, 43.75, 44.3, bev=(0.02, 3))

    # coffee table: walnut top, black frame, lower shelf, a few objects
    tx, tz = 85.6, 42.7
    B.box("furniture", "wood_walnut", tx - 0.7, tx + 0.7, y + 0.36, y + 0.4, tz - 0.4, tz + 0.4, bev=(0.012, 3))
    B.box("furniture", "wood_walnut", tx - 0.62, tx + 0.62, y + 0.1, y + 0.12, tz - 0.32, tz + 0.32, bev=(0.006, 2))
    for ox in (-0.64, 0.64):
        for oz in (-0.34, 0.34):
            B.cbox("furniture", "metal_black", tx + ox, y + 0.18, tz + oz, 0.03, 0.36, 0.03)
    B.box("decor", "paper_navy", tx - 0.45, tx - 0.15, y + 0.4, y + 0.43, tz - 0.2, tz + 0.02, bev=(0.003, 1))
    B.box("decor", "paper_cream", tx - 0.43, tx - 0.17, y + 0.43, y + 0.455, tz - 0.18, tz, bev=(0.003, 1))
    B.cylinder("decor", "ceramic_dark", tx + 0.3, tz + 0.05, 0.16, y + 0.4, y + 0.47, r1=0.2, seg=32)
    B.cylinder("decor", "ceramic_white", tx + 0.0, tz + 0.18, 0.05, y + 0.4, y + 0.62, r1=0.035, seg=20)
    B.box("decor", "paper_grey", tx - 0.4, tx - 0.1, y + 0.12, y + 0.17, tz - 0.15, tz + 0.15, bev=(0.003, 1))

    # lounge chairs facing the sofa (building.js 84.3/86.9, 40.4)
    for cx in (84.3, 86.9):
        cz = 40.4
        for ox in (-0.36, 0.36):
            for oz in (-0.36, 0.36):
                B.cbox("furniture", "wood_oak", cx + ox, y + 0.15, cz + oz, 0.04, 0.3, 0.04, bev=(0.008, 2))
            B.box("furniture", "wood_oak", cx + ox - 0.025, cx + ox + 0.025, y + 0.3, y + 0.58, cz - 0.38, cz - 0.34, bev=(0.008, 2))
            B.box("furniture", "wood_oak", cx + ox - 0.03, cx + ox + 0.03, y + 0.56, y + 0.6, cz - 0.38, cz + 0.36, bev=(0.012, 2))
        B.box("furniture", "wood_oak", cx - 0.36, cx + 0.36, y + 0.24, y + 0.28, cz - 0.38, cz + 0.38, bev=(0.01, 2))
        B.box("furniture", "leather_tan", cx - 0.32, cx + 0.32, y + 0.28, y + 0.42, cz - 0.3, cz + 0.36, bev=(0.05, 4))
        B.box("furniture", "leather_tan", cx - 0.32, cx + 0.32, y + 0.36, y + 0.86, cz - 0.4, cz - 0.24, bev=(0.06, 4))
    # side table between chair and sofa end
    B.cylinder("furniture", "wood_walnut", 83.35, 44.4, 0.22, y + 0.5, y + 0.53, seg=32)
    B.cylinder("furniture", "metal_black", 83.35, 44.4, 0.018, y + 0.02, y + 0.5, seg=12)
    B.cylinder("furniture", "metal_black", 83.35, 44.4, 0.16, y, y + 0.02, seg=24)


def build_dining(B):
    y = YB
    dx, dz = PENDANT[0], PENDANT[2]
    # table: walnut top, two trestle legs on a stretcher
    B.box("furniture", "wood_walnut", dx - 1.1, dx + 1.1, y + 0.72, y + 0.76, dz - 0.55, dz + 0.55, bev=(0.012, 3))
    for ox in (-0.78, 0.78):
        B.box("furniture", "wood_walnut", dx + ox - 0.03, dx + ox + 0.03, y + 0.06, y + 0.72, dz - 0.32, dz + 0.32, bev=(0.01, 2))
        B.box("furniture", "wood_walnut", dx + ox - 0.04, dx + ox + 0.04, y, y + 0.06, dz - 0.4, dz + 0.4, bev=(0.01, 2))
    B.box("furniture", "wood_walnut", dx - 0.75, dx + 0.75, y + 0.2, y + 0.25, dz - 0.025, dz + 0.025, bev=(0.008, 2))
    # six chairs, upholstered seat, oak frame and back on the outer side
    for ox in (-0.75, 0.0, 0.75):
        for oz in (-0.8, 0.8):
            cx, cz, s = dx + ox, dz + oz, (1 if oz > 0 else -1)
            for lx in (-0.19, 0.19):
                for lz in (-0.19, 0.19):
                    B.cbox("furniture", "wood_oak", cx + lx, y + 0.22, cz + lz, 0.032, 0.44, 0.032, bev=(0.006, 2))
            B.box("furniture", "fabric_dining", cx - 0.22, cx + 0.22, y + 0.42, y + 0.49, cz - 0.22, cz + 0.22, bev=(0.025, 3))
            for lx in (-0.19, 0.19):
                B.cbox("furniture", "wood_oak", cx + lx, y + 0.68, cz + s * 0.19, 0.032, 0.4, 0.032, bev=(0.006, 2))
            B.box("furniture", "wood_oak", cx - 0.21, cx + 0.21, y + 0.7, y + 0.86, cz + s * 0.19 - 0.02, cz + s * 0.19 + 0.02, bev=(0.012, 2))
    # table setting
    B.cylinder("decor", "ceramic_stone", dx - 0.2, dz, 0.18, y + 0.76, y + 0.84, r1=0.22, seg=32)
    B.cylinder("decor", "ceramic_white", dx + 0.35, dz - 0.05, 0.06, y + 0.76, y + 0.98, r1=0.045, seg=20)
    B.cylinder("decor", "ceramic_white", dx + 0.48, dz + 0.1, 0.045, y + 0.76, y + 0.9, r1=0.03, seg=20)

    # pendant: rod from the ceiling, brass dome, warm diffuser (glow at y + 2.35)
    B.cylinder("lights", "metal_black", dx, dz, 0.006, y + 2.55, YC, seg=8)
    B.cylinder("lights", "metal_black", dx, dz, 0.07, YC - 0.02, YC, seg=24)
    B.cylinder("lights", "metal_brass", dx, dz, 0.3, y + 2.33, y + 2.47, r1=0.2, seg=40, cap=False)
    B.cylinder("lights", "metal_brass", dx, dz, 0.2, y + 2.47, y + 2.56, r1=0.06, seg=40)
    B.cylinder("lights", "light_warm", dx, dz, 0.27, y + 2.36, y + 2.37, seg=40)


def build_walls(B):
    y = YB
    r = random.Random(2024)
    # sideboard on the x0 wall (building.js x0 + 0.25, z 39.5, 2.8 long)
    sz0, sz1, sx1 = 38.1, 40.9, X0 + 0.46
    for lz in (sz0 + 0.1, sz1 - 0.1):
        for lx in (X0 + 0.06, sx1 - 0.06):
            B.cbox("furniture", "metal_black", lx, y + 0.07, lz, 0.03, 0.14, 0.03)
    B.box("furniture", "wood_walnut", X0 + 0.02, sx1, y + 0.14, y + 0.84, sz0, sz1, bev=(0.008, 2))
    for k in range(1, 4):
        zz = sz0 + k * (sz1 - sz0) / 4
        B.box("furniture", "wood_gap", sx1, sx1 + 0.002, y + 0.18, y + 0.8, zz - 0.003, zz + 0.003)
    for k in range(4):
        zz = sz0 + (k + 0.5) * (sz1 - sz0) / 4 + (0.25 if k % 2 == 0 else -0.25)
        B.box("decor", "metal_brass", sx1, sx1 + 0.02, y + 0.62, y + 0.74, zz - 0.008, zz + 0.008)
    B.cylinder("decor", "ceramic_dark", X0 + 0.25, 38.6, 0.09, y + 0.84, y + 1.24, r1=0.06, seg=24)
    B.cylinder("decor", "ceramic_stone", X0 + 0.24, 40.4, 0.12, y + 0.84, y + 0.96, r1=0.13, seg=24)
    for i, mat in enumerate(("paper_navy", "paper_cream", "paper_red")):
        B.box("decor", mat, X0 + 0.1, X0 + 0.38, y + 0.84 + i * 0.035, y + 0.875 + i * 0.035, 39.2 + i * 0.01, 39.45 - i * 0.01, bev=(0.003, 1))

    # art on the x0 wall: abstract canvas in oak frames (building.js 39.5 / 44.4)
    def art(zc, yc, w, h, blocks):
        B.box("decor", "wood_oak", X0, X0 + 0.035, yc - h / 2, yc + h / 2, zc - w / 2, zc + w / 2, bev=(0.004, 1))
        # each paint layer stands 1 cm proud of the one under it: coplanar layers z-fight in the browser
        for i, (mat, a0, a1, b0, b1) in enumerate(blocks):
            B.box("decor", mat, X0 + 0.03, X0 + 0.045 + 0.01 * i, yc - h / 2 + 0.04 + b0 * (h - 0.08), yc - h / 2 + 0.04 + b1 * (h - 0.08),
                  zc - w / 2 + 0.04 + a0 * (w - 0.08), zc - w / 2 + 0.04 + a1 * (w - 0.08))
    art(39.5, y + 1.85, 1.5, 1.0, [("art_cream", 0, 1, 0, 1), ("art_terracotta", 0.08, 0.62, 0.12, 0.88),
                                   ("art_charcoal", 0.7, 0.74, 0.1, 0.9)])
    art(44.4, y + 1.7, 0.8, 0.8, [("art_cream", 0, 1, 0, 1), ("art_teal", 0.1, 0.9, 0.1, 0.58)])

    # bookshelf on the z0 wall (building.js 84.6, 2.6 wide, 2.3 high)
    bx0, bx1, bz1 = 83.3, 85.9, Z0 + 0.36
    B.box("furniture", "wood_walnut", bx0, bx1, y, y + 2.3, Z0, Z0 + 0.02)
    for xa in (bx0, bx1 - 0.03, (bx0 + bx1) / 2 - 0.015):
        B.box("furniture", "wood_oak", xa, xa + 0.03, y, y + 2.3, Z0, bz1, bev=(0.004, 1))
    shelves = [y + 0.06] + [y + 0.45 + i * 0.55 for i in range(4)]
    B.box("furniture", "wood_oak", bx0, bx1, y, y + 0.06, Z0, bz1, bev=(0.004, 1))
    for sy in shelves[1:]:
        B.box("furniture", "wood_oak", bx0 + 0.03, bx1 - 0.03, sy - 0.03, sy, Z0, bz1, bev=(0.004, 1))
    B.box("furniture", "wood_oak", bx0, bx1, y + 2.27, y + 2.3, Z0, bz1, bev=(0.004, 1))
    bays = [(bx0 + 0.04, (bx0 + bx1) / 2 - 0.02), ((bx0 + bx1) / 2 + 0.02, bx1 - 0.04)]
    for si, sy in enumerate(shelves[:-1]):
        top = shelves[si + 1] - 0.03 if si + 1 < len(shelves) else y + 2.27
        for bi, (xa, xb) in enumerate(bays):
            x = xa
            fill = r.uniform(0.45, 0.9)
            if (si + bi) % 3 == 2:   # an object bay: vase / box instead of a full row
                B.cylinder("decor", r.choice(["ceramic_white", "ceramic_dark", "ceramic_stone"]), (xa + xb) / 2 + r.uniform(-0.2, 0.2),
                           Z0 + 0.18, 0.07, sy, sy + r.uniform(0.18, 0.3), r1=0.05, seg=20)
                fill = 0.35
            while x < xa + (xb - xa) * fill:
                w = r.uniform(0.022, 0.05)
                h = min(top - sy - 0.02, r.uniform(0.2, 0.32))
                d = r.uniform(0.16, 0.24)
                B.box("decor", r.choice(BOOKS), x, x + w, sy, sy + h, Z0 + 0.03, Z0 + 0.03 + d)
                x += w + 0.002
            if r.random() < 0.5 and x < xb - 0.25:   # a short stack lying flat
                for k in range(r.randint(2, 4)):
                    B.box("decor", r.choice(BOOKS), x + 0.04, x + 0.24, sy + k * 0.035, sy + k * 0.035 + 0.033, Z0 + 0.04, Z0 + 0.25)


def build_extras(B):
    y = YB
    # recessed downlight trims
    for x, z in DOWNLIGHTS:
        B.cylinder("lights", "metal_white", x, z, 0.075, YC - 0.006, YC, seg=24)
        B.cylinder("lights", "light_panel", x, z, 0.05, YC - 0.008, YC - 0.006, seg=24)
    # dining rug, flat weave
    B.box("decor", "fabric_rugdark", 80.3, 83.7, y, y + 0.01, 33.9, 37.7, bev=(0.005, 2))
    # reading corner on the x0 wall: lounge chair, ottoman, small lamp
    cx, cz = 80.1, 45.9
    B.box("furniture", "wood_walnut", cx - 0.42, cx + 0.42, y + 0.08, y + 0.14, cz - 0.42, cz + 0.42, bev=(0.012, 2))
    for ox in (-0.36, 0.36):
        for oz in (-0.36, 0.36):
            B.cbox("furniture", "metal_black", cx + ox, y + 0.04, cz + oz, 0.03, 0.08, 0.03)
    B.box("furniture", "fabric_ochre", cx - 0.38, cx + 0.38, y + 0.14, y + 0.4, cz - 0.38, cz + 0.4, bev=(0.06, 4))
    B.box("furniture", "fabric_ochre", cx - 0.42, cx - 0.24, y + 0.14, y + 0.95, cz - 0.4, cz + 0.42, bev=(0.07, 4))
    B.box("furniture", "fabric_ochre", cx - 0.4, cx + 0.38, y + 0.14, y + 0.62, cz + 0.26, cz + 0.42, bev=(0.06, 4))
    B.box("furniture", "fabric_ochre", cx - 0.4, cx + 0.38, y + 0.14, y + 0.62, cz - 0.42, cz - 0.26, bev=(0.06, 4))
    B.box("furniture", "fabric_ochre", cx + 0.55, cx + 1.0, y + 0.06, y + 0.38, cz - 0.24, cz + 0.24, bev=(0.06, 4))
    B.cylinder("furniture", "metal_black", 79.75, 46.75, 0.13, y, y + 0.02, seg=24)
    B.cylinder("furniture", "metal_black", 79.75, 46.75, 0.01, y + 0.02, y + 1.38, seg=10)
    B.cylinder("lights", "fabric_shade", 79.75, 46.75, 0.16, y + 1.35, y + 1.58, r1=0.12, seg=28, cap=False)
    # writing desk by the +x glass, between the plant and the curtains
    dz0, dz1, dx0, dx1 = 34.2, 35.9, 89.15, 89.85
    B.box("furniture", "wood_oak", dx0, dx1, y + 0.72, y + 0.75, dz0, dz1, bev=(0.008, 2))
    for zz in (dz0 + 0.05, dz1 - 0.05):
        B.box("furniture", "metal_black", dx0 + 0.04, dx1 - 0.04, y, y + 0.72, zz - 0.012, zz + 0.012)
    B.box("furniture", "wood_oak", dx0 + 0.02, dx1 - 0.02, y + 0.6, y + 0.72, dz0 + 0.08, dz0 + 0.6, bev=(0.006, 2))
    ch = (88.7, 35.05)
    for lx in (-0.19, 0.19):
        for lz in (-0.19, 0.19):
            B.cbox("furniture", "wood_oak", ch[0] + lx, y + 0.22, ch[1] + lz, 0.032, 0.44, 0.032, bev=(0.006, 2))
    B.box("furniture", "leather_tan", ch[0] - 0.22, ch[0] + 0.22, y + 0.42, y + 0.49, ch[1] - 0.22, ch[1] + 0.22, bev=(0.025, 3))
    B.box("furniture", "wood_oak", ch[0] - 0.23, ch[0] - 0.19, y + 0.49, y + 0.84, ch[1] - 0.21, ch[1] + 0.21, bev=(0.012, 2))
    B.cylinder("furniture", "metal_brass", 89.55, 35.55, 0.07, y + 0.75, y + 0.77, seg=20)
    B.cylinder("furniture", "metal_brass", 89.55, 35.55, 0.008, y + 0.77, y + 1.1, seg=8)
    B.cylinder("lights", "fabric_shade", 89.55, 35.55, 0.1, y + 1.06, y + 1.2, r1=0.06, seg=24, cap=False)
    B.box("decor", "paper_cream", 89.3, 89.62, y + 0.75, y + 0.77, 34.6, 35.0, bev=(0.003, 1))
    # TV-free media console under the bookshelf side, long low walnut bench by the door wall
    B.box("furniture", "wood_walnut", 86.6, 89.6, y + 0.12, y + 0.5, Z0 + 0.02, Z0 + 0.46, bev=(0.008, 2))
    for xx in (86.7, 89.5):
        B.box("furniture", "metal_black", xx - 0.015, xx + 0.015, y, y + 0.12, Z0 + 0.06, Z0 + 0.42)
    for k in range(1, 3):
        xx = 86.6 + k * 1.0
        B.box("furniture", "wood_gap", xx - 0.003, xx + 0.003, y + 0.15, y + 0.47, Z0 + 0.46, Z0 + 0.462)
    B.cylinder("decor", "ceramic_stone", 87.2, Z0 + 0.24, 0.12, y + 0.5, y + 0.82, r1=0.07, seg=24)
    B.cylinder("decor", "ceramic_dark", 88.9, Z0 + 0.24, 0.16, y + 0.5, y + 0.58, r1=0.18, seg=28)


def leaf(B, mat, base, yaw, pitch, length, width, droop=0.25):
    """single leaf, two triangles folded on the midrib, from base (three.js) along yaw/pitch"""
    d = Vector((math.cos(pitch) * math.cos(yaw), math.sin(pitch), math.cos(pitch) * math.sin(yaw)))
    side = Vector((-math.sin(yaw), 0, math.cos(yaw)))
    b = Vector(base)
    tip = b + d * length - Vector((0, droop * length, 0))
    mid = b + d * (length * 0.45) - Vector((0, droop * 0.25 * length, 0))
    up = Vector((0, width * 0.15, 0))
    l, rr = mid + side * width / 2 + up, mid - side * width / 2 + up
    B.poly("plants", mat, [tuple(b), tuple(l), tuple(tip)])
    B.poly("plants", mat, [tuple(b), tuple(tip), tuple(rr)])


def build_plants(B):
    y = YB
    r = random.Random(7)
    # tall fig by the glass (building.js 89.7, 32.3)
    px, pz = 89.7, 32.3
    B.cylinder("plants", "ceramic_stone", px, pz, 0.24, y, y + 0.5, r1=0.27, seg=32)
    B.cylinder("plants", "soil_pot", px, pz, 0.25, y + 0.46, y + 0.47, seg=32)
    stems = []
    for i in range(3):
        a = i * 2.1 + 0.3
        top = (px + math.cos(a) * 0.12, y + r.uniform(1.6, 1.95), pz + math.sin(a) * 0.12)
        B.cylinder("plants", "bark_stem", px + math.cos(a) * 0.04, pz + math.sin(a) * 0.04, 0.022, y + 0.46, top[1], seg=8)
        stems.append(top)
    for _ in range(70):
        sx, sy, sz = r.choice(stems)
        h = r.uniform(0.9, sy - y)
        a = r.uniform(0, 2 * math.pi)
        base = (sx + math.cos(a) * 0.05, y + h, sz + math.sin(a) * 0.05)
        leaf(B, r.choice(["leaf_deep", "leaf_fresh"]), base, a, r.uniform(-0.1, 0.6), r.uniform(0.22, 0.32), r.uniform(0.14, 0.2))
    # low bushy plant beside the sofa (building.js 83.3, 46.6)
    px, pz = 83.3, 46.6
    B.cylinder("plants", "ceramic_white", px, pz, 0.2, y, y + 0.44, r1=0.21, seg=32)
    B.cylinder("plants", "soil_pot", px, pz, 0.2, y + 0.4, y + 0.41, seg=32)
    for _ in range(90):
        a = r.uniform(0, 2 * math.pi)
        base = (px + math.cos(a) * 0.05, y + 0.42, pz + math.sin(a) * 0.05)
        leaf(B, r.choice(["leaf_deep", "leaf_fresh"]), base, a, r.uniform(0.6, 1.35), r.uniform(0.35, 0.6), r.uniform(0.05, 0.08), droop=0.35)


def build_curtains(B):
    """sheer curtains gathered at the bays the camera does not fly through (building.js positions)"""
    r = random.Random(11)
    h = FH - 0.62
    panels = [("z", X1 - 0.33, z) for z in (33.4, 36.1, 40.2)] + [("x", x, Z1 - 0.33) for x in (80.3, 83.0, 85.7)]
    for axis, a, b in panels:
        w, nu, nv = 0.55, 28, 10
        ph = r.uniform(0, 6.28)
        rows = []
        for j in range(nv + 1):
            yy = YB + 0.12 + h * j / nv
            row = []
            for i in range(nu + 1):
                u = i / nu
                along = (u - 0.5) * w
                fold = math.sin(u * 2 * math.pi * 4.5 + ph) * (0.045 + 0.015 * (1 - j / nv))
                if axis == "z":
                    row.append((a + fold, yy, b + along))
                else:
                    row.append((b + along, yy, a + fold))
            rows.append(row)
        B.grid("curtain", "fabric_curtain", rows)


def build_lights(B):
    # flush square panel the wire feeds (building.js ROOM_LIGHTS[0], glow 1.1 x 1.1)
    lx, lz = LIGHT_MAIN
    B.box("lights", "metal_white", lx - 0.6, lx + 0.6, YC - 0.05, YC, lz - 0.6, lz + 0.6, bev=(0.01, 2))
    B.box("lights", "light_panel", lx - 0.55, lx + 0.55, YC - 0.056, YC - 0.05, lz - 0.55, lz + 0.55)
    # linear light over the window side (building.js 88.0, 36.0, 1.6 x 0.5)
    B.box("lights", "metal_white", 87.15, 88.85, YC - 0.05, YC, 35.7, 36.3, bev=(0.01, 2))
    B.box("lights", "light_panel", 87.2, 88.8, YC - 0.056, YC - 0.05, 35.75, 36.25)


def add_render_lights(coll):
    def area(name, x, y, z, sx, sz, watts, kelvin_rgb):
        d = bpy.data.lights.new(name, "AREA")
        d.shape = "RECTANGLE"
        d.size, d.size_y = sx, sz
        d.energy = watts
        d.color = kelvin_rgb
        ob = bpy.data.objects.new(name, d)
        ob.location = T(x, y, z)
        ob.rotation_euler = (0, 0, 0)   # area lights face -Z (down) in Blender
        coll.objects.link(ob)

    def point(name, x, y, z, watts, rgb, radius=0.05):
        d = bpy.data.lights.new(name, "POINT")
        d.energy = watts
        d.color = rgb
        d.shadow_soft_size = radius
        ob = bpy.data.objects.new(name, d)
        ob.location = T(x, y, z)
        coll.objects.link(ob)

    def spot(name, x, z, watts, rgb, angle=70):
        d = bpy.data.lights.new(name, "SPOT")
        d.energy = watts
        d.color = rgb
        d.spot_size = math.radians(angle)
        d.spot_blend = 0.6
        d.shadow_soft_size = 0.04
        ob = bpy.data.objects.new(name, d)
        ob.location = T(x, YC - 0.03, z)
        coll.objects.link(ob)

    warm, warmer = (1.0, 0.82, 0.62), (1.0, 0.72, 0.48)
    area("LGT_panel", LIGHT_MAIN[0], YC - 0.07, LIGHT_MAIN[1], 1.1, 1.1, 900, warm)
    area("LGT_linear", 88.0, YC - 0.07, 36.0, 1.6, 0.5, 450, warm)
    point("LGT_pendant", PENDANT[0], YB + 2.4, PENDANT[2], 120, warmer, 0.2)
    point("LGT_floorlamp", 88.2, YB + 1.62, 46.4, 90, warmer, 0.15)
    point("LGT_readlamp", 79.75, YB + 1.45, 46.75, 60, warmer, 0.12)
    point("LGT_desklamp", 89.55, YB + 1.12, 35.55, 25, warmer, 0.05)
    for i, (x, z) in enumerate(DOWNLIGHTS):
        spot(f"LGT_down{i}", x, z, 110, warm)
    # bounce stand-in: a weak shadowless sun pointing up lifts the ceiling evenly
    # (an upward area light left a hard-edged patch in EEVEE)
    d = bpy.data.lights.new("LGT_fill", "SUN")
    d.energy, d.color, d.use_shadow = 0.8, warm, False
    ob = bpy.data.objects.new("LGT_fill", d)
    ob.rotation_euler = (math.pi, 0, 0)
    coll.objects.link(ob)


def cam_look(name, pos, target, fov, coll):
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(fov)
    cd.clip_start, cd.clip_end = 0.05, 2000
    ob = bpy.data.objects.new(name, cd)
    ob.location = T(*pos)
    ob.rotation_euler = (T(*target) - ob.location).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(ob)
    return ob


def setup_world(scene):
    w = scene.world or bpy.data.worlds.new("TAMIRA_room_night")
    scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.018, 0.022, 0.05, 1)
    bg.inputs["Strength"].default_value = 0.6
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        try:
            scene.render.engine = "BLENDER_EEVEE"
        except TypeError as e:
            print("engine:", e)
    ee = scene.eevee
    for attr, val in (("use_raytracing", True), ("use_shadows", True), ("taa_render_samples", 64)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        pass
    scene.view_settings.exposure = 0.4
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080


# ----------------------------------------------------------------------------- build
GROUPS = ("shell", "facade", "entry", "furniture", "decor", "plants", "curtain", "lights", "rig")


def build():
    if SCENE_NAME in bpy.data.scenes:
        scene = bpy.data.scenes[SCENE_NAME]
        for ob in list(scene.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        for c in list(scene.collection.children_recursive):
            bpy.data.collections.remove(c)
    else:
        scene = bpy.data.scenes.new(SCENE_NAME)
    if bpy.context.window:
        bpy.context.window.scene = scene
    colls = {}
    for g in GROUPS:
        c = bpy.data.collections.new(f"ROOM_{g}")
        scene.collection.children.link(c)
        colls[g] = c
    mats = make_materials()
    B = Batch()
    build_shell(B)
    build_facade(B)
    build_living(B)
    build_dining(B)
    build_walls(B)
    build_extras(B)
    build_plants(B)
    build_curtains(B)
    build_lights(B)
    objs = B.finish(mats, colls)
    if FURN_KIT:
        objs += place_kit(colls, mats)
    add_render_lights(colls["rig"])
    cx, cy, cz = (X0 + X1) / 2, YB + 1.5, (Z0 + Z1) / 2
    cams = [
        # outside the open corner, the view in the reference capture
        cam_look("CAM_exterior", (X1 + 10.5, YB + 3.2, Z1 + 9.0), (cx + 0.8, cy - 0.2, cz + 0.8), 40, colls["rig"]),
        # inside, along the ceiling wire past the entry point (building.js ENTER)
        cam_look("CAM_follow", (86.5, YB + 2.2, 33.0), (84.5, YB + 1.2, 41.5), 62, colls["rig"]),
        # interior overview from the inner corner
        cam_look("CAM_interior", (79.4, YB + 2.3, 31.8), (86.5, YB + 0.7, 43.0), 64, colls["rig"]),
    ]
    scene.camera = cams[0]
    setup_world(scene)
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    print(f"built: {len(objs)} batched objects, {tri} tris (before bevel)")
    return scene


# ----------------------------------------------------------------------------- web export
# "entry" (corner glass) stays out: the city GLB already glazes this bay (entry__* meshes)
WEB_COLLECTIONS = ("shell", "facade", "furniture", "decor", "plants", "curtain", "lights")


def export_web(path, scene_name=SCENE_NAME):
    """GLB in the web world frame: no UVs/textures (constant PBR factors per material class),
    bevel modifiers applied, Y-up."""
    scene = bpy.data.scenes[scene_name]
    if bpy.context.window:
        bpy.context.window.scene = scene
    vl = scene.view_layers[0]
    for lc in vl.layer_collection.children:
        lc.exclude = lc.name.replace("ROOM_", "") not in WEB_COLLECTIONS
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_visible=True, export_yup=True, export_apply=True,
        export_normals=True, export_texcoords=False, export_tangents=False, export_materials="EXPORT",
        export_vertex_color="NONE", export_cameras=False, export_lights=False, export_extras=False,
        export_draco_mesh_compression_enable=False, export_animations=False, use_active_scene=True)
    for lc in vl.layer_collection.children:
        lc.exclude = False
    print("exported", path)
