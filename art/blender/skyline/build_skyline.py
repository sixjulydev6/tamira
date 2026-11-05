"""Tamira skyline hero: modular architectural district (prompt.md, stages B-D).

Builds the focal planted tower, a varied supporting district on the existing footprints, streets,
lots, parks, planting and scale cues, as editable Blender geometry with named PBR material classes.
Everything is authored in the website's world frame so wiring/room anchors stay valid:

    three.js (x, y, z)  ->  Blender (x, -z, y)      metres, Y-up on the web, Z-up here
    hero bounds, floors (y0 50.4, h 3.6), riser [79, 31.4], room floor 19 all come from
    src/story/skyline/layout.js; BUILDINGS footprints are reused unchanged.

Material names carry the runtime class before the first underscore (glass_, frame_, concrete_,
metal_, fin_, roof_, leaf_, bark_, asphalt_, paving_, grass_, paint_, car_). The web loader maps
classes to shader behaviour (night windows only on glass, scan excludes leaf/bark).

Run in a live Blender (MCP) with:  exec(open(path).read()); build()
or headless:  blender -b --python build_skyline.py -- <out_dir>
Deterministic: all randomness is seeded.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

SCENE_NAME = "TAMIRA_skyline"

# ----------------------------------------------------------------------------- layout (layout.js)
HERO = dict(min=(33, -2, -30), max=(97, 216, 52))
FLOOR_Y0, FLOOR_H, FLOOR_N = 50.4, 3.6, 34
SINGLE = dict(floor=19, feedX=86.5, enterZ=35.3)
ROOM = dict(x0=78.6, x1=90.4, z0=31.0, z1=47.4)
SUBSTATION = (214, 0, 124)
BUILDINGS = [
  [55, 92.5, -200, -162.5, 147.7], [40, 62.5, 45, 75, 130.4], [10, 40, -20, 52.5, 117.8], [5, 20, 112.5, 132.5, 107],
  [45, 65, -52.5, -25, 101.1], [-30, 5, 165, 200, 96.5], [70, 90, -102.5, -77.5, 92.1], [-87.5, -52.5, -47.5, -10, 90.4],
  [135, 147.5, -140, -110, 88.1], [2.5, 32.5, -165, -145, 85.4], [-47.5, -25, -77.5, -52.5, 84.2], [-55, -25, 102.5, 117.5, 84.2],
  [62.5, 92.5, 45, 77.5, 83.8], [-132.5, -105, -27.5, -12.5, 75], [-92.5, -65, -2.5, 12.5, 75], [10, 45, -60, -30, 64.4],
  [40, 70, -180, -150, 61.2], [-100, -75, 125, 150, 56.3], [120, 137.5, -147.5, -135, 52.9], [130, 155, -25, 7.5, 52.5],
  [-145, -127.5, 65, 85, 51.4], [-35, -15, -117.5, -92.5, 51.4], [10, 45, 85, 132.5, 51], [-62.5, -17.5, 0, 55, 51],
  [85, 105, -82.5, -60, 50.8], [72.5, 105, -132.5, -100, 50.8], [72.5, 85, -35, -12.5, 47.5], [90, 140, 0, 95, 44.3],
  [-155, -145, 75, 87.5, 44.1], [25, 47.5, -110, -90, 44.1], [-152.5, -127.5, -112.5, -95, 40.2], [132.5, 150, 97.5, 125, 40.2],
  [-140, -110, 47.5, 90, 20.9], [110, 152.5, -62.5, -25, 20.7], [-35, 2.5, -162.5, -132.5, 20.7], [-75, -27.5, -147.5, -100, 20.7]
]
# traffic roads used by ground.js (night headlights run along these)
ROADS_X = [205, 232, -215]
ROADS_Z = [250, -262]

FH = 3.6  # one storey; the tower grid starts at y = 0 so FLOOR_Y0 = 14 storeys

# Day environment (ambientCG DayEnvironmentHDRI114, CC0). Set to the EXR path to light the scene with it;
# camera rays still see the procedural sky (the panorama's lower half is a rooftop terrace).
HDRI_PATH = None
HDRI_STRENGTH = 1.6   # same gain as the web runtime (DAY_ENV_GAIN)
HDRI_CLAMP = 16.0     # sun disc clamp: the sun lamp stays the only sun (web: day-env-1k.hdr)

# Image-textured materials (look-dev in Blender). TEX_DIR is the folder holding one sub-folder per
# entry with basecolor.jpg / roughness.jpg / height.jpg; None keeps every material flat colour.
# brick_reclaimed: Poliigon BrickWallReclaimed 8320 (asset/texture/), 512 px colour, 256 px height
# and roughness; ~19 courses per tile, so tile = 1.5 m matches 75 mm brick courses.
TEX_DIR = None
TEXTURED = {"brick_reclaimed": dict(folder="brick_reclaimed_8320", tile=1.5, bump=0.5, bump_dist=0.02)}
# District glazing: Poliigon BuildingFacadeOffice 11934 (asset/texture/), 512 px colour only. The map is a
# whole elevation: 5 office storeys (275.5 px each, image v 0.300..0.973, spandrel centre on the floor line)
# over a shopfront strip (v 0..0.300). Office glass repeats every 5 storeys from the 7.2 m podium line;
# shopfronts fit the 7.2 m podium. 10 bays per tile -> 2.4 m bays at tile_u 24 m. Glass pixels are near
# black, so roughness comes from colour brightness (glass 0.06 = visible sun glint, panels/blinds 0.65).
_FACADE = dict(folder="facade_office_11934", tile_u=24.0, rough=(0.06, 0.65))
TEXTURED.update({
    "glass_blue": dict(_FACADE, z0=7.2, tile_v=18.0, v0=0.30005, vspan=0.6726, repeat=True, u_off=0.0),
    "glass_grey": dict(_FACADE, z0=7.2, tile_v=18.0, v0=0.30005, vspan=0.6726, repeat=True, u_off=0.37),
    "glass_warm": dict(_FACADE, z0=7.2, tile_v=18.0, v0=0.30005, vspan=0.6726, repeat=True, u_off=0.71),
    "glass_store": dict(_FACADE, z0=0.0, tile_v=7.2, v0=0.0, vspan=0.300, repeat=False, u_off=0.0),
})
# Park trees: the BlenderKit "A tree" (asset/tree/) reduced by prepare_tree.py to a ~900-tri kit
# (art/blender/skyline/tree/tree_kit.blend: object tree_ash, materials leaf_ash / bark_ash). When set, every
# tree (park, outer park, lawns, streets, roof gardens) uses it; only the low shrubs / planter bushes keep the
# procedural kit. Applied when the instances are made, so placement and randomness are unchanged.
# Look-dev textures: TEX_DIR/tree_ash/{leaf_COL.png,bark_COL.jpg,bark_NRM.jpg}.
TREE_KIT = None
KIT_TREE = {"round": "ash", "round_lo": "ash", "column": "ash"}
TREE_LIMIT = 3000   # total kit trees: street / lawn / roof trees all stay; park + outer-park groves are thinned


# per-building wall material overrides (BUILDINGS index -> material)
WALL_OVERRIDE = {22: "brick_reclaimed"}  # front punched block, x 10..45, z 85..132.5


def T(x, y, z):
    """three.js world -> Blender world"""
    return Vector((x, -z, y))


# ----------------------------------------------------------------------------- materials
MATS = {
    # name: (base rgb (linear), metallic, roughness, extra)
    "glass_hero":     ((0.030, 0.052, 0.080), 0.0, 0.05, {}),
    "glass_blue":     ((0.040, 0.060, 0.085), 0.0, 0.09, {}),
    "glass_grey":     ((0.055, 0.058, 0.062), 0.0, 0.10, {}),
    "glass_warm":     ((0.070, 0.064, 0.056), 0.0, 0.12, {}),
    "glass_store":    ((0.030, 0.034, 0.038), 0.0, 0.08, {}),
    "frame_light":    ((0.42, 0.41, 0.39), 0.0, 0.48, {}),
    "ground_far":     ((0.11, 0.13, 0.09), 0.0, 0.92, {}),
    "frame_dark":     ((0.070, 0.074, 0.080), 0.0, 0.38, {}),
    "metal_alu":      ((0.80, 0.80, 0.78), 1.0, 0.36, {}),
    "metal_service":  ((0.42, 0.43, 0.44), 1.0, 0.55, {}),
    "fin_bronze":     ((0.36, 0.25, 0.16), 0.85, 0.42, {}),
    "fin_champagne":  ((0.62, 0.56, 0.46), 0.8, 0.40, {}),
    "concrete_warm":  ((0.56, 0.53, 0.48), 0.0, 0.78, {}),
    "concrete_light": ((0.70, 0.68, 0.64), 0.0, 0.72, {}),
    "concrete_grey":  ((0.40, 0.40, 0.40), 0.0, 0.80, {}),
    "concrete_sand":  ((0.60, 0.50, 0.38), 0.0, 0.80, {}),
    "concrete_brick": ((0.36, 0.20, 0.14), 0.0, 0.85, {}),
    "brick_reclaimed": ((0.30, 0.13, 0.08), 0.0, 0.88, {}),
    "roof_membrane":  ((0.17, 0.17, 0.17), 0.0, 0.88, {}),
    "roof_gravel":    ((0.30, 0.29, 0.27), 0.0, 0.95, {}),
    "paving_stone":   ((0.42, 0.41, 0.38), 0.0, 0.80, {}),
    "paving_curb":    ((0.55, 0.54, 0.51), 0.0, 0.75, {}),
    "asphalt_road":   ((0.060, 0.062, 0.065), 0.0, 0.90, {}),
    "paint_road":     ((0.62, 0.62, 0.60), 0.0, 0.70, {}),
    "grass_lawn":     ((0.090, 0.150, 0.045), 0.0, 0.85, {}),
    "water_pond":     ((0.020, 0.040, 0.045), 0.0, 0.05, {}),
    "soil_planter":   ((0.10, 0.075, 0.05), 0.0, 0.95, {}),
    "leaf_deep":      ((0.040, 0.085, 0.030), 0.0, 0.70, {}),
    "leaf_fresh":     ((0.075, 0.140, 0.040), 0.0, 0.68, {}),
    "leaf_olive":     ((0.090, 0.110, 0.050), 0.0, 0.72, {}),
    "bark_trunk":     ((0.090, 0.070, 0.055), 0.0, 0.90, {}),
    "car_white":      ((0.70, 0.70, 0.70), 0.0, 0.30, {}),
    "car_grey":       ((0.20, 0.21, 0.22), 0.4, 0.35, {}),
    "car_dark":       ((0.035, 0.038, 0.045), 0.3, 0.30, {}),
    "lobby_glow":     ((0.90, 0.80, 0.62), 0.0, 0.50, {"emit": 0.0}),
}


def make_materials():
    out = {}
    for name, (rgb, met, rough, extra) in MATS.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Metallic"].default_value = met
        bsdf.inputs["Roughness"].default_value = rough
        if name.startswith("glass_"):
            bsdf.inputs["IOR"].default_value = 1.5
            bsdf.inputs["Specular IOR Level"].default_value = 0.5
            # never mirror-sharp: a 0.06 floor spreads the sun lamp into a visible glint on every facade
            bsdf.inputs["Roughness"].default_value = max(rough, 0.06)
            # broad clear-coat lobe: real panes are never flat mirrors, so sunlit facades catch a glint
            # well off the exact mirror angle (the day camera sits 21 deg off it on the +X faces)
            bsdf.inputs["Coat Weight"].default_value = 1.0
            bsdf.inputs["Coat Roughness"].default_value = 0.36
            bsdf.inputs["Coat IOR"].default_value = 1.5
        if TEX_DIR and name in TEXTURED:
            texture_material(m, bsdf, TEXTURED[name])
        m.diffuse_color = (*[min(1, c * 1.6) for c in rgb], 1)
        out[name] = m
    return out


def texture_material(m, bsdf, t):
    """colour / roughness images and a height bump on the UVMap made by Batch.finish"""
    import os
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
            nt.nodes.remove(n)
    d = os.path.join(TEX_DIR, t["folder"])
    if "vspan" in t:
        facade_material(m, nt, bsdf, d, t)
        return

    def img(fname, cs, x, y):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(d, fname), check_existing=True)
        n.image.colorspace_settings.name = cs
        n.location = (x, y)
        return n
    base = img("basecolor.jpg", "sRGB", -700, 300)
    rough = img("roughness.jpg", "Non-Color", -700, 0)
    height = img("height.jpg", "Non-Color", -700, -300)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-350, -300)
    bump.inputs["Strength"].default_value = t["bump"]
    bump.inputs["Distance"].default_value = t["bump_dist"]
    nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    nt.links.new(height.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def facade_material(m, nt, bsdf, d, t):
    """facade elevation on glass: v folded into the office (repeat) or shopfront (clamp) band of the image"""
    import os
    uvn = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    fold = nt.nodes.new("ShaderNodeMath")
    fold.operation = "FRACT" if t["repeat"] else "MINIMUM"
    fold.inputs[1].default_value = 0.999
    band = nt.nodes.new("ShaderNodeMath")
    band.operation = "MULTIPLY_ADD"
    band.inputs[1].default_value = t["vspan"]
    band.inputs[2].default_value = t["v0"]
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(d, "basecolor.jpg"), check_existing=True)
    img.image.colorspace_settings.name = "sRGB"
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["From Min"].default_value = 0.02
    rr.inputs["From Max"].default_value = 0.20
    rr.inputs["To Min"].default_value, rr.inputs["To Max"].default_value = t["rough"]
    for i, n in enumerate((uvn, sep, fold, band, comb, img, bw, rr)):
        n.location = (-1400 + i * 170, -100)
    L = nt.links.new
    L(uvn.outputs["UV"], sep.inputs[0])
    L(sep.outputs["Y"], fold.inputs[0])
    L(fold.outputs[0], band.inputs[0])
    L(sep.outputs["X"], comb.inputs["X"])
    L(band.outputs[0], comb.inputs["Y"])
    L(comb.outputs[0], img.inputs["Vector"])
    L(img.outputs["Color"], bsdf.inputs["Base Color"])
    L(img.outputs["Color"], bw.inputs[0])
    L(bw.outputs[0], rr.inputs["Value"])
    L(rr.outputs["Result"], bsdf.inputs["Roughness"])


def box_uv(b, t):
    """world-space box projection in metres: walls get (horizontal, height) so courses / storeys stay level.
    Facade entries keep raw storey coordinates ((z - z0) / tile_v); the shader folds them into the image."""
    uv = b.loops.layers.uv.verify()
    b.normal_update()
    tu = t.get("tile_u", t.get("tile"))
    tv = t.get("tile_v", t.get("tile"))
    z0, uo = t.get("z0", 0.0), t.get("u_off", 0.0)
    for f in b.faces:
        nx, ny, nz = (abs(c) for c in f.normal)
        for lp in f.loops:
            x, y, z = lp.vert.co
            if nz >= nx and nz >= ny:
                lp[uv].uv = (x / tu + uo, y / tv)
            elif nx >= ny:
                lp[uv].uv = (y / tu + uo, (z - z0) / tv)
            else:
                lp[uv].uv = (x / tu + uo, (z - z0) / tv)


# ----------------------------------------------------------------------------- mesh builder
class Batch:
    """One bmesh per (group, material). Boxes are axis aligned in three.js coordinates."""

    def __init__(self):
        self.bms = {}

    def bm(self, group, mat):
        k = (group, mat)
        if k not in self.bms:
            self.bms[k] = bmesh.new()
        return self.bms[k]

    def box(self, group, mat, x0, x1, y0, y1, z0, z1, faces="all"):
        if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4:
            return
        b = self.bm(group, mat)
        v = [b.verts.new(T(x, y, z)) for x, y, z in (
            (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
            (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1))]
        # T() is a proper rotation, so three.js CCW winding stays outward
        quads = {"-y": (0, 1, 2, 3), "+y": (4, 7, 6, 5), "-z": (0, 4, 5, 1), "+z": (3, 2, 6, 7),
                 "-x": (0, 3, 7, 4), "+x": (1, 5, 6, 2)}
        for key, q in quads.items():
            if faces != "all" and key not in faces:
                continue
            b.faces.new([v[i] for i in q])

    def quad(self, group, mat, pts):
        b = self.bm(group, mat)
        b.faces.new([b.verts.new(T(*p)) for p in pts][::-1])

    def cylinder(self, group, mat, cx, cz, r, y0, y1, seg=24, cap=True):
        b = self.bm(group, mat)
        ring0 = [b.verts.new(T(cx + r * math.cos(a), y0, cz + r * math.sin(a)))
                 for a in (2 * math.pi * i / seg for i in range(seg))]
        ring1 = [b.verts.new(T(cx + r * math.cos(a), y1, cz + r * math.sin(a)))
                 for a in (2 * math.pi * i / seg for i in range(seg))]
        for i in range(seg):
            j = (i + 1) % seg
            b.faces.new((ring0[i], ring1[i], ring1[j], ring0[j]))
        if cap:
            b.faces.new(ring1[::-1])
            b.faces.new(ring0)

    def finish(self, mats, collections):
        objs = []
        for (group, mat), b in self.bms.items():
            bmesh.ops.remove_doubles(b, verts=b.verts, dist=0.001)
            if mat in TEXTURED:
                box_uv(b, TEXTURED[mat])
            me = bpy.data.meshes.new(f"{group}_{mat}")
            b.to_mesh(me)
            b.free()
            me.materials.append(mats[mat])
            for p in me.polygons:
                p.use_smooth = False
            ob = bpy.data.objects.new(f"{group}__{mat}", me)
            collections[group].objects.link(ob)
            objs.append(ob)
        self.bms = {}
        return objs


# ----------------------------------------------------------------------------- facade kits
def ring_bands(B, g, mat, x0, x1, z0, z1, y, h, out):
    """slab-edge band around a footprint, non-overlapping corners"""
    B.box(g, mat, x0 - out, x1 + out, y, y + h, z0 - out, z0)
    B.box(g, mat, x0 - out, x1 + out, y, y + h, z1, z1 + out)
    B.box(g, mat, x0 - out, x0, y, y + h, z0, z1)
    B.box(g, mat, x1, x1 + out, y, y + h, z0, z1)


def glass_skin(B, g, mat, x0, x1, z0, z1, y0, y1, holes=()):
    """four glass planes; holes = [(face, a0, a1, h0, h1)] cut out of a face"""
    faces = {
        "+x": lambda a, h: (x1, h, a), "-x": lambda a, h: (x0, h, a),
        "+z": lambda a, h: (a, h, z1), "-z": lambda a, h: (a, h, z0)}
    spans = {"+x": (z0, z1), "-x": (z0, z1), "+z": (x0, x1), "-z": (x0, x1)}
    for f, P in faces.items():
        a0, a1 = spans[f]
        cuts = sorted([h for h in holes if h[0] == f], key=lambda h: h[1])
        rects = [(a0, a1, y0, y1)]
        for _, c0, c1, h0, h1 in cuts:
            nxt = []
            for r in rects:
                ra0, ra1, rh0, rh1 = r
                if c1 <= ra0 or c0 >= ra1 or h1 <= rh0 or h0 >= rh1:
                    nxt.append(r)
                    continue
                if c0 > ra0: nxt.append((ra0, c0, rh0, rh1))
                if c1 < ra1: nxt.append((c1, ra1, rh0, rh1))
                cc0, cc1 = max(c0, ra0), min(c1, ra1)
                if h0 > rh0: nxt.append((cc0, cc1, rh0, h0))
                if h1 < rh1: nxt.append((cc0, cc1, h1, rh1))
            rects = nxt
        for ra0, ra1, rh0, rh1 in rects:
            pts = [P(ra0, rh0), P(ra1, rh0), P(ra1, rh1), P(ra0, rh1)]
            if f in ("-x", "+z"):
                pts = pts[::-1]
            B.quad(g, mat, pts)


def fins(B, g, mat, x0, x1, z0, z1, y0, y1, step, depth, width, faces=("+x", "-x", "+z", "-z"), gaps=()):
    """full-height vertical fins standing proud of the glass; gaps = [(face, a0, a1, h0, h1)]"""
    for f in faces:
        if f in ("+x", "-x"):
            a0, a1 = z0, z1
        else:
            a0, a1 = x0, x1
        n = max(1, int(round((a1 - a0) / step)))
        for i in range(1, n):
            a = a0 + (a1 - a0) * i / n
            spans = [(y0, y1)]
            for gf, c0, c1, h0, h1 in gaps:
                if gf == f and c0 <= a <= c1:
                    spans = [s for sp in spans for s in ((sp[0], min(sp[1], h0)), (max(sp[0], h1), sp[1])) if s[1] - s[0] > .1]
            for s0, s1 in spans:
                if f == "+x": B.box(g, mat, x1, x1 + depth, s0, s1, a - width / 2, a + width / 2)
                if f == "-x": B.box(g, mat, x0 - depth, x0, s0, s1, a - width / 2, a + width / 2)
                if f == "+z": B.box(g, mat, a - width / 2, a + width / 2, s0, s1, z1, z1 + depth)
                if f == "-z": B.box(g, mat, a - width / 2, a + width / 2, s0, s1, z0 - depth, z0)


def roof(B, g, r, x0, x1, z0, z1, y, parapet_mat, plant=None):
    """membrane, parapet and sparse service equipment"""
    B.box(g, "roof_membrane", x0, x1, y, y + 0.25, z0, z1, faces=("+y",))
    t, h = 0.35, 1.1
    B.box(g, parapet_mat, x0 - .1, x1 + .1, y, y + h, z0 - .1, z0 + t)
    B.box(g, parapet_mat, x0 - .1, x1 + .1, y, y + h, z1 - t, z1 + .1)
    B.box(g, parapet_mat, x0 - .1, x0 + t, y, y + h, z0 + t, z1 - t)
    B.box(g, parapet_mat, x1 - t, x1 + .1, y, y + h, z0 + t, z1 - t)
    w, d = x1 - x0, z1 - z0
    if w > 10 and d > 10:
        # stair/lift overrun and a plant screen offset from centre
        cx, cz = x0 + w * (0.3 + 0.2 * r.random()), z0 + d * (0.3 + 0.2 * r.random())
        ow, od = min(9, w * .3), min(7, d * .28)
        B.box(g, parapet_mat, cx - ow / 2, cx + ow / 2, y, y + 4.2, cz - od / 2, cz + od / 2)
        B.box(g, "roof_membrane", cx - ow / 2 - .1, cx + ow / 2 + .1, y + 4.2, y + 4.45, cz - od / 2 - .1, cz + od / 2 + .1)
        for _ in range(r.randint(2, 4)):
            ux = x0 + 2 + r.random() * (w - 6); uz = z0 + 2 + r.random() * (d - 6)
            if abs(ux - cx) < ow and abs(uz - cz) < od:
                continue
            B.box(g, "metal_service", ux, ux + 2.4, y + .25, y + 1.9, uz, uz + 1.6)
    if plant is not None and w > 8 and d > 8:
        plant.append((x0 + 1.2, x1 - 1.2, z0 + 1.2, z1 - 1.2, y + 0.25))


def podium_storefront(B, g, x0, x1, z0, z1, h, mat_frame):
    """double-height ground floor: dark storefront glass, mullions, canopy over one entrance"""
    glass_skin(B, g, "glass_store", x0 + .6, x1 - .6, z0 + .6, z1 - .6, 0, h)
    fins(B, g, mat_frame, x0 + .6, x1 - .6, z0 + .6, z1 - .6, 0, h, 3.0, .25, .18)
    ring_bands(B, g, mat_frame, x0 + .6, x1 - .6, z0 + .6, z1 - .6, h - .6, .6, .6)
    B.box(g, "lobby_glow", x0 + .9, x1 - .9, 0, h - .3, z0 + .9, z1 - .9, faces=("+x", "-x", "+z", "-z"))


def family_curtain(B, g, r, f, mats):
    x0, x1, z0, z1, H = f
    podium_storefront(B, g, x0, x1, z0, z1, 7.2, "frame_dark")
    glass_skin(B, g, mats["glass"], x0, x1, z0, z1, 7.2, H)
    for y in frange(7.2, H - .1, FH):
        ring_bands(B, g, mats["frame"], x0, x1, z0, z1, y, .42, .22)
    fins(B, g, "metal_alu", x0, x1, z0, z1, 7.2, H, 1.6, .22, .12)
    roof(B, g, r, x0, x1, z0, z1, H, mats["frame"])


def family_punched(B, g, r, f, mats):
    x0, x1, z0, z1, H = f
    podium_storefront(B, g, x0, x1, z0, z1, 7.2, "frame_dark")
    i = .45
    glass_skin(B, g, mats["glass"], x0 + i, x1 - i, z0 + i, z1 - i, 7.2, H)
    for y in frange(7.2, H - .1, FH):
        ring_bands(B, g, mats["wall"], x0 + i, x1 - i, z0 + i, z1 - i, y, 1.15, i)
    fins(B, g, mats["wall"], x0 + i, x1 - i, z0 + i, z1 - i, 7.2, H, 3.2, i, .9)
    roof(B, g, r, x0, x1, z0, z1, H, mats["wall"])


def family_ribbon(B, g, r, f, mats):
    x0, x1, z0, z1, H = f
    podium_storefront(B, g, x0, x1, z0, z1, 7.2, "frame_dark")
    i = .6
    glass_skin(B, g, mats["glass"], x0 + i, x1 - i, z0 + i, z1 - i, 7.2, H)
    for y in frange(7.2, H - .1, FH):
        ring_bands(B, g, mats["wall"], x0 + i, x1 - i, z0 + i, z1 - i, y, 1.35, i)
    fins(B, g, "frame_dark", x0 + i, x1 - i, z0 + i, z1 - i, 7.2, H, 2.4, .12, .1)
    roof(B, g, r, x0, x1, z0, z1, H, mats["wall"])


def family_finned(B, g, r, f, mats):
    """U6: layered floor bands, dense vertical fins, recessed dark glazing"""
    x0, x1, z0, z1, H = f
    podium_storefront(B, g, x0, x1, z0, z1, 7.2, "frame_dark")
    i = .9
    glass_skin(B, g, "glass_grey", x0 + i, x1 - i, z0 + i, z1 - i, 7.2, H)
    for k, y in enumerate(frange(7.2, H - .1, FH)):
        o = .25 if k % 2 else 0
        ring_bands(B, g, mats["wall"], x0 + i, x1 - i, z0 + i, z1 - i, y, .38, i + o)
    fins(B, g, mats["fin"], x0 + i, x1 - i, z0 + i, z1 - i, 7.2, H, 1.05, i - .05, .14)
    roof(B, g, r, x0, x1, z0, z1, H, mats["wall"])


def family_balcony(B, g, r, f, mats):
    x0, x1, z0, z1, H = f
    family_punched(B, g, r, f, mats)
    face = r.choice(("+x", "-z", "+z"))
    for k, y in enumerate(frange(10.8, H - 2, FH)):
        if face == "+x":
            for zz in frange(z0 + 2, z1 - 5, 7.5):
                if (k + int(zz)) % 3 == 0: continue
                B.box(g, mats["wall"], x1, x1 + 1.6, y, y + .22, zz, zz + 4.8)
                B.box(g, "metal_alu", x1 + 1.5, x1 + 1.6, y + .22, y + 1.15, zz, zz + 4.8)
        else:
            zf = z1 if face == "+z" else z0
            sgn = 1 if face == "+z" else -1
            for xx in frange(x0 + 2, x1 - 5, 7.5):
                if (k + int(xx)) % 3 == 0: continue
                za, zb = sorted((zf, zf + 1.6 * sgn))
                B.box(g, mats["wall"], xx, xx + 4.8, y, y + .22, za, zb)
                zr0, zr1 = sorted((zf + 1.5 * sgn, zf + 1.6 * sgn))
                B.box(g, "metal_alu", xx, xx + 4.8, y + .22, y + 1.15, zr0, zr1)


def family_stepped(B, g, r, f, mats, plant):
    """two-three setbacks with planted terraces"""
    x0, x1, z0, z1, H = f
    tiers = 3 if H > 70 else 2
    w, d = x1 - x0, z1 - z0
    yb = 0
    for t in range(tiers):
        inset = t * min(w, d) * 0.13
        top = snap(H * (t + 1) / tiers)
        fx = (x0 + inset, x1 - inset * (0.4 if t % 2 else 1), z0 + inset * (1 if t % 2 else .4), z1 - inset)
        kit = family_curtain if t == tiers - 1 else family_ribbon
        sub = (fx[0], fx[1], fx[2], fx[3], top)
        if t == 0:
            kit(B, g, r, sub, mats)
        else:
            # upper tier: skin from yb to top only
            glass_skin(B, g, mats["glass"], *fx, yb, top)
            for y in frange(yb, top - .1, FH):
                ring_bands(B, g, mats["frame"] if kit is family_curtain else mats["wall"], *fx, y, .45 if kit is family_curtain else 1.3, .3)
            fins(B, g, "metal_alu", *fx, yb, top, 1.6, .22, .12)
            roof(B, g, r, *fx, top, mats["wall"])
        if t < tiers - 1:
            plant.append((fx[0] + 1, fx[1] - 1, fx[2] + 1, fx[3] - 1, top + .25))
        yb = top


def family_round(B, g, r, f, mats):
    x0, x1, z0, z1, H = f
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    R = min(x1 - x0, z1 - z0) / 2
    B.cylinder(g, "glass_store", cx, cz, R - .6, 0, 7.2, 32)
    B.cylinder(g, mats["glass"], cx, cz, R - .35, 7.2, H, 40, cap=False)
    for y in frange(7.2, H - .1, FH):
        B.cylinder(g, mats["frame"], cx, cz, R, y, y + .4, 40)
    for i in range(40):
        a = 2 * math.pi * (i + .5) / 40
        px, pz = cx + (R - .2) * math.cos(a), cz + (R - .2) * math.sin(a)
        B.box(g, "metal_alu", px - .09, px + .09, 7.2, H, pz - .09, pz + .09)
    B.cylinder(g, "roof_membrane", cx, cz, R - .2, H, H + .25, 40)
    B.cylinder(g, mats["frame"], cx, cz, R * .45, H + .25, H + 3.8, 24)


def frange(a, b, s):
    v = a
    while v < b - 1e-6:
        yield v
        v += s


def snap(h):
    return max(FH * 3, round(h / FH) * FH)


PALETTES = [
    dict(glass="glass_blue", frame="frame_light", wall="concrete_light", fin="fin_champagne"),
    dict(glass="glass_grey", frame="frame_dark", wall="concrete_warm", fin="fin_bronze"),
    dict(glass="glass_blue", frame="frame_dark", wall="concrete_grey", fin="fin_champagne"),
    dict(glass="glass_warm", frame="frame_light", wall="concrete_sand", fin="fin_bronze"),
    dict(glass="glass_grey", frame="frame_light", wall="concrete_brick", fin="fin_bronze"),
    dict(glass="glass_blue", frame="frame_light", wall="concrete_warm", fin="fin_champagne"),
]


# ----------------------------------------------------------------------------- focal tower
def build_hero(B, plant, trees):
    g = "hero"
    r = random.Random(11)
    # podium: four storeys, roof garden
    px0, px1, pz0, pz1 = 33, 97, -30, 52
    podium_storefront(B, g, px0, px1, pz0, pz1, 7.2, "frame_dark")
    glass_skin(B, g, "glass_hero", px0 + .5, px1 - .5, pz0 + .5, pz1 - .5, 7.2, 14.4)
    for y in (7.2, 10.8):
        ring_bands(B, g, "concrete_light", px0 + .5, px1 - .5, pz0 + .5, pz1 - .5, y, 1.0, .5)
    fins(B, g, "concrete_light", px0 + .5, px1 - .5, pz0 + .5, pz1 - .5, 7.2, 14.4, 4.0, .5, .7)
    B.box(g, "concrete_light", px0, px1, 14.4, 14.9, pz0, pz1, faces=("+y", "+x", "-x", "+z", "-z"))
    # entrance canopy on the street (+X) face
    B.box(g, "concrete_light", px1, px1 + 6, 6.4, 6.9, 6, 24)
    for zz in (7, 23):
        B.box(g, "metal_alu", px1 + 5.6, px1 + 5.9, 0, 6.4, zz - .15, zz + .15)
    # podium roof garden: planters at the edge + lawn strips
    for (a0, a1, b0, b1) in ((px0 + 1, px1 - 1, pz0 + 1, pz0 + 3.5), (px0 + 1, px1 - 1, pz1 - 3.5, pz1 - 1), (px1 - 3.5, px1 - 1, pz0 + 3.5, pz1 - 3.5)):
        planter(B, g, a0, a1, b0, b1, 14.9, 1.0)
        plant.append((a0 + .4, a1 - .4, b0 + .4, b1 - .4, 15.9))

    # rear slab (taller) and front block (room side). Glass lines meet the room's window line.
    REAR = (36, 64, -26, 46)
    FRONT = (64, 90.5, -16, 47.5)
    rear_top, front_top = 205.2, 180.0
    room_y0 = FLOOR_Y0 + SINGLE["floor"] * FLOOR_H
    room_y1 = room_y0 + FLOOR_H
    # the room entry bay: kept out of the main skin and built as its own removable object
    holes = [("+x", ROOM["z0"], FRONT[3], room_y0, room_y1), ("+z", ROOM["x0"], FRONT[1], room_y0, room_y1)]

    # rear slab: light stone frame, deep fins (U2 / U3 rhythm)
    x0, x1, z0, z1 = REAR
    glass_skin(B, g, "glass_hero", x0, x1, z0, z1, 14.4, rear_top - 10.8)
    for y in frange(14.4, rear_top - 10.8 - .1, FH):
        ring_bands(B, g, "frame_light", x0, x1, z0, z1, y, .36, .5)
    hero_fins(B, g, x0, x1, z0, z1, 14.4, rear_top - 10.8, .7)
    # crown: three set-back storeys inside a planted terrace
    cx0, cx1, cz0, cz1 = x0 + 3.5, x1 - 3.5, z0 + 3.5, z1 - 3.5
    B.box(g, "concrete_light", x0 - .55, x1 + .55, rear_top - 10.8, rear_top - 10.3, z0 - .55, z1 + .55, faces=("+y", "-y", "+x", "-x", "+z", "-z"))
    terrace_ring(B, g, plant, x0, x1, z0, z1, cx0, cx1, cz0, cz1, rear_top - 10.3)
    glass_skin(B, g, "glass_hero", cx0, cx1, cz0, cz1, rear_top - 10.3, rear_top)
    for y in frange(rear_top - 10.3, rear_top - .1, FH):
        ring_bands(B, g, "frame_light", cx0, cx1, cz0, cz1, y, .45, .4)
    hero_fins(B, g, cx0, cx1, cz0, cz1, rear_top - 10.3, rear_top, .5)
    roof(B, g, r, cx0, cx1, cz0, cz1, rear_top, "concrete_light", plant)
    B.box(g, "metal_alu", cx0 + 6, cx0 + 8, rear_top, rear_top + 9, cz0 + 20, cz0 + 22)  # maintenance mast

    # front block with two planted setbacks on the street face, clear of the room floor
    x0, x1, z0, z1 = FRONT
    s1, s2 = 154.8, 169.2
    body = (x0, x1, z0, z1)
    glass_skin(B, g, "glass_hero", *body, 14.4, s1, holes=holes)
    for y in frange(14.4, s1 - .1, FH):
        ring_bands(B, g, "frame_light", *body, y, .36, .5)
    gaps = [("+x", ROOM["z0"] - .5, FRONT[3] + .5, room_y0 - .2, room_y1 + .2),
            ("+z", ROOM["x0"] - .5, FRONT[1] + .5, room_y0 - .2, room_y1 + .2)]
    hero_fins(B, g, *body, 14.4, s1, .7, faces=("+x", "+z", "-z"), gaps=gaps)
    # tier 2
    t2 = (x0, x1 - 6, z0, z1)
    B.box(g, "concrete_light", x0 - .55, x1 + .55, s1, s1 + .5, z0 - .55, z1 + .55, faces=("+y", "-y", "+x", "+z", "-z"))
    terrace_strip(B, g, plant, t2[1], x1, z0, z1, s1 + .5)
    glass_skin(B, g, "glass_hero", *t2, s1 + .5, s2)
    for y in frange(s1 + .5, s2 - .1, FH):
        ring_bands(B, g, "frame_light", *t2, y, .5, .5)
    hero_fins(B, g, *t2, s1 + .5, s2, .65, faces=("+x", "+z", "-z"))
    # tier 3
    t3 = (x0, x1 - 12, z0 + 4, z1 - 4)
    B.box(g, "concrete_light", t2[0], t2[1] + .5, s2, s2 + .5, t2[2] - .5, t2[3] + .5, faces=("+y", "-y", "+x", "+z", "-z"))
    terrace_strip(B, g, plant, t3[1], t2[1], t2[2], t2[3], s2 + .5)
    glass_skin(B, g, "glass_hero", *t3, s2 + .5, front_top)
    for y in frange(s2 + .5, front_top - .1, FH):
        ring_bands(B, g, "frame_light", *t3, y, .45, .45)
    hero_fins(B, g, *t3, s2 + .5, front_top, .6, faces=("+x", "+z", "-z"))
    roof(B, g, r, *t3, front_top, "concrete_light", plant)
    # corner planters every few storeys on the street corner (the current tower's green tiers)
    for fl in (6, 11, 25, 30, 36):
        y = fl * FH
        if room_y0 - 8 < y < room_y1 + 8:
            continue
        planter(B, g, x1 + .55, x1 + 2.2, z0 - 1.5, z0 + 6, y, .9)
        plant.append((x1 + .7, x1 + 2.0, z0 - 1.2, z0 + 5.6, y + .9))

    # the removable entry bay (glass + mullions), hidden by the web runtime once the camera climbs
    E = "entry"
    glass_skin_face(B, E, "glass_hero", "+x", x1, ROOM["z0"], z1, room_y0, room_y1)
    glass_skin_face(B, E, "glass_hero", "+z", z1, ROOM["x0"], x1, room_y0, room_y1)
    for zz in frange(ROOM["z0"] + 1.8, z1, 1.8):
        B.box(E, "frame_light", x1, x1 + .7, room_y0, room_y1, zz - .16, zz + .16)
    for xx in frange(ROOM["x0"] + 1.8, x1, 1.8):
        B.box(E, "frame_light", xx - .16, xx + .16, room_y0, room_y1, z1, z1 + .7)


def hero_fins(B, g, x0, x1, z0, z1, y0, y1, depth, faces=("+x", "-x", "+z", "-z"), gaps=()):
    """U2/U3 rhythm: stone fins every 3.6 m, slim aluminium mullions between"""
    fins(B, g, "frame_light", x0, x1, z0, z1, y0, y1, 3.6, depth * .8, .26, faces=faces, gaps=gaps)
    fins(B, g, "metal_alu", x0, x1, z0, z1, y0, y1, 1.2, .12, .07, faces=faces, gaps=gaps)


def glass_skin_face(B, g, mat, face, c, a0, a1, h0, h1):
    if face == "+x":
        B.quad(g, mat, [(c, h0, a0), (c, h0, a1), (c, h1, a1), (c, h1, a0)])
    else:
        B.quad(g, mat, [(a1, h0, c), (a0, h0, c), (a0, h1, c), (a1, h1, c)])


def planter(B, g, x0, x1, z0, z1, y, h):
    t = .25
    B.box(g, "concrete_light", x0, x1, y, y + h, z0, z0 + t)
    B.box(g, "concrete_light", x0, x1, y, y + h, z1 - t, z1)
    B.box(g, "concrete_light", x0, x0 + t, y, y + h, z0 + t, z1 - t)
    B.box(g, "concrete_light", x1 - t, x1, y, y + h, z0 + t, z1 - t)
    B.box(g, "soil_planter", x0 + t, x1 - t, y, y + h - .12, z0 + t, z1 - t, faces=("+y",))


def terrace_ring(B, g, plant, x0, x1, z0, z1, cx0, cx1, cz0, cz1, y):
    for a in ((x0 - .3, x1 + .3, z0 - .3, z0 + 1.6), (x0 - .3, x1 + .3, z1 - 1.6, z1 + .3),
              (x0 - .3, x0 + 1.6, z0 + 1.6, z1 - 1.6), (x1 - 1.6, x1 + .3, z0 + 1.6, z1 - 1.6)):
        planter(B, g, *a, y, 1.0)
        plant.append((a[0] + .3, a[1] - .3, a[2] + .3, a[3] - .3, y + 1.0))
    B.box(g, "metal_alu", x0 - .25, x1 + .25, y + 1.0, y + 2.1, z0 - .3, z0 - .25)


def terrace_strip(B, g, plant, xa, xb, z0, z1, y):
    planter(B, g, xb - 1.9, xb + .3, z0, z1, y, 1.0)
    plant.append((xb - 1.6, xb, z0 + .4, z1 - .4, y + 1.0))
    planter(B, g, xa + .6, xa + 2.0, z0 + 3, z1 - 3, y, .7)
    plant.append((xa + .8, xa + 1.8, z0 + 3.4, z1 - 3.4, y + .7))


# ----------------------------------------------------------------------------- district
def build_district(B, plant):
    r = random.Random(23)
    order = list(range(len(BUILDINGS)))
    for i in order:
        x0, x1, z0, z1, h = BUILDINGS[i]
        H = snap(h)
        f = (x0 + .5, x1 - .5, z0 + .5, z1 - .5, H)
        mats = dict(PALETTES[(i * 5 + 1) % len(PALETTES)])
        if i in WALL_OVERRIDE:
            mats["wall"] = WALL_OVERRIDE[i]
        w, d = x1 - x0, z1 - z0
        sq = min(w, d) / max(w, d)
        if H > 100 and sq > .8 and i == 3:
            family_round(B, "city", r, f, mats)
        elif H > 95:
            [family_curtain, family_finned, family_stepped][i % 3](B, "city", r, f, mats, *( [plant] if i % 3 == 2 else []))
        elif H > 60:
            k = i % 4
            if k == 0: family_finned(B, "city", r, f, mats)
            elif k == 1: family_stepped(B, "city", r, f, mats, plant)
            elif k == 2: family_ribbon(B, "city", r, f, mats)
            else: family_balcony(B, "city", r, f, mats)
        else:
            k = i % 3
            if k == 0: family_balcony(B, "city", r, f, mats)
            elif k == 1: family_punched(B, "city", r, f, mats)
            else: family_ribbon(B, "city", r, f, mats)
        # only roof gardens on low buildings that the elevated cameras see
        if H < 30 and (i % 2 == 0):
            plant.append((f[0] + 2, f[1] - 2, f[2] + 2, f[3] - 2, H + .25))


# ----------------------------------------------------------------------------- ground
# GZ1 reaches past the district into the front-left park (replaces outer filler blocks there)
GX0, GX1, GZ0, GZ1, CELL = -250, 250, -300, 760, 2.0
PARK_Z0 = 300.0
POND = (-40.0, 560.0, 48.0)


def _vnoise(x, z, seed=17):
    """smooth value noise in [0, 1]"""
    def h(i, j):
        n = (i * 374761393 + j * 668265263 + seed * 2246822519) & 0xFFFFFFFF
        n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
        return (n ^ (n >> 16)) / 4294967295.0
    i, j = math.floor(x), math.floor(z)
    fx, fz = x - i, z - j
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    a, b, c, d = h(i, j), h(i + 1, j), h(i, j + 1), h(i + 1, j + 1)
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz


def park_feature(x, z):
    """front-left park: 4 = pond, 1 = path, None = lawn"""
    if z < PARK_Z0:
        return None
    px, pz, pr = POND
    dx, dz = x - px, z - pz
    a = math.atan2(dz, dx)
    rr = pr * (1 + .18 * math.sin(3 * a) + .1 * math.cos(5 * a + 1.3))
    dist = math.hypot(dx, dz)
    if dist < rr:
        return 4
    if rr + 5 < dist < rr + 9:
        return 1  # path around the pond
    if abs(x - (60 + 40 * math.sin((z - PARK_Z0) / 70))) < 2.2:
        return 1  # meandering north-south path
    if abs(z - (430 + 26 * math.sin(x / 55))) < 2.2:
        return 1  # cross path
    if abs(z - (650 + 18 * math.sin(x / 40 + 2))) < 1.8:
        return 1
    return None


def grove(x, z):
    """tree density: dense groves, open meadows"""
    n = .65 * _vnoise(x / 70, z / 70) + .35 * _vnoise(x / 23, z / 23, 29)
    return .004 + .095 * max(0.0, min(1.0, (n - .5) / .2))


def footprints():
    fp = [(b[0], b[1], b[2], b[3]) for b in BUILDINGS]
    fp.append((33, 97, -30, 52))
    return fp


def build_ground(B, trees, cars):
    nx, nz = int((GX1 - GX0) / CELL), int((GZ1 - GZ0) / CELL)
    fp = footprints()
    # class: 0 road, 1 sidewalk/lot, 2 park lawn, 3 substation compound
    cls = [[0] * nx for _ in range(nz)]

    def dist_fp(x, z):
        best = 1e9
        for a0, a1, b0, b1 in fp:
            dx = max(a0 - x, 0, x - a1); dz = max(b0 - z, 0, z - b1)
            best = min(best, max(dx, dz))
        return best

    def on_traffic(x, z):
        return any(abs(x - rx) < 7 for rx in ROADS_X) or any(abs(z - rz) < 8 for rz in ROADS_Z)

    for j in range(nz):
        z = GZ0 + (j + .5) * CELL
        for i in range(nx):
            x = GX0 + (i + .5) * CELL
            if on_traffic(x, z):
                continue
            if 211 < x < 226 and 106 < z < 142:
                cls[j][i] = 3
                continue
            pf = park_feature(x, z)
            if pf is not None:
                cls[j][i] = pf
                continue
            d = dist_fp(x, z)
            if d < 7.0:
                cls[j][i] = 1
            elif d > 21:
                cls[j][i] = 2
            elif x > 199 or x < -209 or z > 243 or z < -255:
                cls[j][i] = 1
    height = {0: 0.0, 1: 0.16, 2: 0.30, 3: 0.20, 4: 0.04}
    mat = {1: "paving_stone", 2: "grass_lawn", 3: "roof_gravel", 4: "water_pond"}
    g = "ground"
    B.box(g, "asphalt_road", GX0, GX1, -0.6, 0.0, GZ0, GZ1, faces=("+y",))
    # tops: row runs merged vertically
    for c in (1, 2, 3, 4):
        runs = {}
        for j in range(nz):
            i = 0
            row = cls[j]
            while i < nx:
                if row[i] != c:
                    i += 1
                    continue
                s = i
                while i < nx and row[i] == c:
                    i += 1
                runs.setdefault((s, i), []).append(j)
        for (s, e), js in runs.items():
            js.sort()
            a = js[0]
            for k in range(1, len(js) + 1):
                if k == len(js) or js[k] != js[k - 1] + 1:
                    b = js[k - 1]
                    B.box(g, mat[c], GX0 + s * CELL, GX0 + e * CELL, height[c] - .02, height[c], GZ0 + a * CELL, GZ0 + (b + 1) * CELL, faces=("+y",))
                    if k < len(js):
                        a = js[k]
    # curbs: vertical faces where a raised class meets a lower one, merged along runs
    def H(j, i):
        if 0 <= j < nz and 0 <= i < nx:
            return height[cls[j][i]]
        return 0.0
    for j in range(nz):
        for side in (-1, 1):
            i = 0
            while i < nx:
                h0, h1 = H(j, i), H(j + side, i)
                if h0 <= h1:
                    i += 1
                    continue
                s = i
                while i < nx and H(j, i) == h0 and H(j + side, i) == h1:
                    i += 1
                zc = GZ0 + (j + (1 if side > 0 else 0)) * CELL
                curb = "paving_curb" if cls[j][s] in (1, 3) else "soil_planter"
                B.box(g, curb, GX0 + s * CELL, GX0 + i * CELL, h1, h0, zc - .001 if side > 0 else zc, zc if side > 0 else zc + .001, faces=("+z" if side > 0 else "-z",))
    for i in range(nx):
        for side in (-1, 1):
            j = 0
            while j < nz:
                h0, h1 = H(j, i), H(j, i + side)
                if h0 <= h1:
                    j += 1
                    continue
                s = j
                while j < nz and H(j, i) == h0 and H(j, i + side) == h1:
                    j += 1
                xc = GX0 + (i + (1 if side > 0 else 0)) * CELL
                curb = "paving_curb" if cls[s][i] in (1, 3) else "soil_planter"
                B.box(g, curb, xc - .001 if side > 0 else xc, xc if side > 0 else xc + .001, h1, h0, GZ0 + s * CELL, GZ0 + j * CELL, faces=("+x" if side > 0 else "-x",))
    # lane markings on the traffic roads
    for rx in ROADS_X:
        for z in frange(GZ0, GZ1, 12):
            if any(abs(z - rz) < 10 for rz in ROADS_Z): continue
            B.box(g, "paint_road", rx - .08, rx + .08, 0, .02, z, z + 6, faces=("+y",))
    for rz in ROADS_Z:
        for x in frange(GX0, GX1, 12):
            if any(abs(x - rx) < 9 for rx in ROADS_X): continue
            B.box(g, "paint_road", x, x + 6, 0, .02, rz - .08, rz + .08, faces=("+y",))
    # substation compound: low switch-room, fence posts (the network's source)
    B.box(g, "concrete_grey", 214, 223, 0.2, 4.4, 112, 122)
    B.box(g, "roof_membrane", 213.8, 223.2, 4.4, 4.6, 111.8, 122.2)
    for z in frange(107, 141, 3):
        B.box(g, "metal_service", 211.2, 211.4, .2, 2.6, z, z + .1)
        B.box(g, "metal_service", 225.6, 225.8, .2, 2.6, z, z + .1)

    # planting: street trees along lot edges facing roads, clusters in parks
    r = random.Random(5)
    for j in range(0, nz, 1):
        for i in range(0, nx, 1):
            c = cls[j][i]
            x = GX0 + (i + .5) * CELL; z = GZ0 + (j + .5) * CELL
            if c == 1:
                # edge cell next to road, on a 10 m rhythm
                nb = [H(j + 1, i), H(j - 1, i), H(j, i + 1), H(j, i - 1)]
                if min(nb) == 0.0 and (int(x) % 10 < 2) and (int(z) % 10 < 2) and dist_fp(x, z) > 3.0 and r.random() < .85:
                    trees.append(("round" if r.random() < .7 else "column", x, .16, z, .8 + r.random() * .45, r.random() * 6.28))
            elif c == 2 and z >= PARK_Z0:
                # park: avenue trees along the roads (image-2 boulevard), groves elsewhere
                nb = [H(j + 1, i), H(j - 1, i), H(j, i + 1), H(j, i - 1)]
                if min(nb) == 0.0:
                    if int(z) % 9 < 2 and r.random() < .9:
                        trees.append(("round_lo", x, .30, z, .85 + r.random() * .35, r.random() * 6.28))
                elif r.random() < grove(x, z):
                    kind = r.choice(("round_lo", "round_lo", "round_lo", "column", "shrub"))
                    trees.append((kind, x + r.uniform(-.8, .8), .30, z + r.uniform(-.8, .8), .7 + r.random() * .65, r.random() * 6.28))
            elif c == 2:
                if r.random() < .035:
                    kind = r.choice(("round", "round", "column", "shrub"))
                    trees.append((kind, x + r.uniform(-.8, .8), .30, z + r.uniform(-.8, .8), .75 + r.random() * .6, r.random() * 6.28))
    # parked / moving-day cars along the traffic roads (scale cues)
    for rx in ROADS_X:
        for z in frange(GZ0 + 5, GZ1 - 5, 9):
            if r.random() < .5 or any(abs(z - rz) < 12 for rz in ROADS_Z): continue
            lane = r.choice((-4.5, -1.6, 1.6, 4.5))
            cars.append((r.choice(("white", "grey", "dark", "white")), rx + lane, z + r.uniform(-2, 2), 0.0 if lane > 0 else math.pi))
    for rz in ROADS_Z:
        for x in frange(GX0 + 5, GX1 - 5, 9):
            if r.random() < .5 or any(abs(x - rx) < 12 for rx in ROADS_X): continue
            lane = r.choice((-4.5, -1.6, 1.6, 4.5))
            cars.append((r.choice(("white", "grey", "dark", "white")), x + r.uniform(-2, 2), rz + lane, math.pi / 2 if lane > 0 else -math.pi / 2))


# ----------------------------------------------------------------------------- outer park
def build_outer_park(B, trees):
    """The park continues past the modelled ground toward the far city: lawn plus groves that
    thin out with distance, so foreground and background read as one landscape."""
    g = "ground"
    X0, X1, Z0, Z1 = -950.0, GX0, PARK_Z0 - 60, 1150.0
    B.box(g, "grass_lawn", X0, X1, -.1, .02, Z0, Z1, faces=("+y",))
    r = random.Random(41)
    step = 6.0
    x = X1 - step / 2
    while x > X0:
        fade = max(0.0, 1 - (X1 - x) / (X1 - X0))  # 1 at the park edge, 0 at the far end
        z = Z0 + step / 2
        while z < Z1:
            edge = min(1.0, (z - Z0) / 60.0) * min(1.0, (Z1 - z) / 120.0)
            if any(abs(x - rx) < 9 for rx in ROADS_X):
                z += step
                continue
            if r.random() < grove(x, z) * 8.5 * (.25 + .75 * fade) * edge:
                kind = r.choice(("round_lo", "round_lo", "round_lo", "column"))
                trees.append((kind, x + r.uniform(-2.5, 2.5), .02, z + r.uniform(-2.5, 2.5), .8 + r.random() * .7, r.random() * 6.28))
            z += step
        x -= step


# ----------------------------------------------------------------------------- planting kit
def species_meshes(mats):
    """three low-poly species + shrub, one mesh each so instances share data (GPU instancing)"""
    out = {}
    rr = random.Random(3)

    def canopy(b, blobs, mat_index):
        for (cx, cy, cz, rad, sz) in blobs:
            res = bmesh.ops.create_icosphere(b, subdivisions=1, radius=rad, matrix=Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((1, 1, sz, 1)))
            for v in res["verts"]:
                n = v.co - Vector((cx, cy, cz))
                v.co += n.normalized() * rad * (rr.random() - .5) * .28
            for f in {f for v in res["verts"] for f in v.link_faces}:
                f.material_index = mat_index

    def trunk(b, h, r0):
        res = bmesh.ops.create_cone(b, cap_ends=False, segments=6, radius1=r0, radius2=r0 * .7, depth=h, matrix=Matrix.Translation((0, 0, h / 2)))
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = 1

    defs = {
        "round": (lambda b: (trunk(b, 3.4, .22), canopy(b, [(0, 0, 5.2, 2.6, .85), (1.1, .5, 4.6, 1.8, .8), (-.9, -.7, 4.8, 1.9, .8)], 0)), "leaf_fresh"),
        "column": (lambda b: (trunk(b, 2.2, .18), canopy(b, [(0, 0, 5.4, 1.5, 2.3)], 0)), "leaf_deep"),
        "round_lo": (lambda b: (trunk(b, 3.0, .2), canopy(b, [(0, 0, 4.9, 2.7, .88)], 0)), "leaf_olive"),
        "shrub": (lambda b: canopy(b, [(0, 0, .7, 1.1, .6), (.7, .3, .6, .8, .6)], 0), "leaf_olive"),
        "planter_shrub": (lambda b: canopy(b, [(0, 0, .45, .7, .65), (.45, .2, .4, .5, .7), (-.4, -.25, .42, .55, .7)], 0), "leaf_deep"),
    }
    if TREE_KIT:
        with bpy.data.libraries.load(TREE_KIT, link=False) as (src, dst):
            dst.meshes = ["tree_ash"]
        out["ash"] = dst.meshes[0]
        if TEX_DIR:
            tree_textures(out["ash"])
    for name, (fn, leaf) in defs.items():
        b = bmesh.new()
        fn(b)
        me = bpy.data.meshes.new(f"tree_{name}")
        b.to_mesh(me)
        b.free()
        me.materials.append(mats[leaf])
        me.materials.append(mats["bark_trunk"])
        for p in me.polygons:
            p.use_smooth = True
        out[name] = me
    return out


def tree_textures(me):
    """look-dev images on the kit's leaf_ash (cutout atlas) / bark_ash (colour + normal)"""
    import os
    d = os.path.join(TEX_DIR, "tree_ash")
    for m in me.materials:
        nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        def img(f, cs):
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = bpy.data.images.load(os.path.join(d, f), check_existing=True)
            t.image.colorspace_settings.name = cs
            return t
        if m.name.startswith("leaf_"):
            t = img("leaf_COL.png", "sRGB")
            cut = nt.nodes.new("ShaderNodeMath")
            cut.operation = "GREATER_THAN"
            cut.inputs[1].default_value = 0.5
            nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
            nt.links.new(t.outputs["Alpha"], cut.inputs[0])
            nt.links.new(cut.outputs[0], b.inputs["Alpha"])
        else:
            nt.links.new(img("bark_COL.jpg", "sRGB").outputs["Color"], b.inputs["Base Color"])
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(img("bark_NRM.jpg", "Non-Color").outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])


def car_meshes(mats):
    out = {}
    for col in ("white", "grey", "dark"):
        b = bmesh.new()
        bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation((0, 0, .55)) @ Matrix.Diagonal((1.85, 4.5, .7, 1)))
        res = bmesh.ops.create_cube(b, size=1, matrix=Matrix.Translation((0, -.2, 1.15)) @ Matrix.Diagonal((1.6, 2.3, .55, 1)))
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = 1
        me = bpy.data.meshes.new(f"car_{col}")
        b.to_mesh(me)
        b.free()
        me.materials.append(mats[f"car_{col}"])
        me.materials.append(mats["glass_store"])
        out[col] = me
    return out


def scatter_planters(plant, trees, seed=9):
    r = random.Random(seed)
    for (x0, x1, z0, z1, y) in plant:
        area = max(0, x1 - x0) * max(0, z1 - z0)
        n = int(min(34, area / 6.0))
        for _ in range(n):
            x = r.uniform(x0, x1); z = r.uniform(z0, z1)
            big = r.random() < .12 and min(x1 - x0, z1 - z0) > 2.5
            trees.append(("round" if big else "planter_shrub", x, y, z, (.55 + r.random() * .3) if big else (1.1 + r.random() * .8), r.random() * 6.28))


# ----------------------------------------------------------------------------- scene, light, cameras
def cam_from_key(name, t, az, el, d, fov, ox, aspect=16 / 9, coll=None):
    a, e = math.radians(az), math.radians(el)
    pos = (t[0] + math.sin(a) * math.cos(e) * d, t[1] + math.sin(e) * d, t[2] + math.cos(a) * math.cos(e) * d)
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(fov)
    cd.clip_start, cd.clip_end = 1, 4000
    # three.js setViewOffset(-ox*W) moves the subject right by ox of the WIDTH;
    # Blender shift is in units of the fitted (vertical) sensor, so scale by aspect
    cd.shift_x = -ox * aspect
    ob = bpy.data.objects.new(name, cd)
    ob.location = T(*pos)
    direction = T(*t) - ob.location
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def setup_world_and_light(scene, coll):
    # runtime sun: elevation 15 deg, azimuth 46 deg (0 = +Z, 90 = +X) in three.js
    el, az = math.radians(15), math.radians(46)
    d3 = (math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el))
    db = T(*d3)
    sun_d = bpy.data.lights.new("LGT_sun", "SUN")
    sun_d.energy = 4.2
    sun_d.angle = math.radians(0.8)
    sun_d.color = (1.0, 0.94, 0.86)
    sun = bpy.data.objects.new("LGT_sun", sun_d)
    sun.rotation_euler = (-db).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(sun)
    w = scene.world or bpy.data.worlds.new("TAMIRA_sky")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    types = [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items]
    for pref in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
        if pref in types:
            sky.sky_type = pref
            break
    try:
        sky.sun_elevation = el
        sky.sun_rotation = math.atan2(db.x, db.y) * -1 + math.pi / 2
        sky.sun_disc = False
        sky.air_density = 1.2
        sky.aerosol_density = 1.6 if hasattr(sky, "aerosol_density") else None
    except Exception as e:  # property names differ between sky models
        print("sky props:", e)
    bg.inputs["Strength"].default_value = 0.35
    nt.links.new(sky.outputs[0], bg.inputs[0])
    if HDRI_PATH:
        # HDRI for lighting/reflections, yawed so its sun (+X, u = 0.5) sits on the lamp azimuth
        coord = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0, 0, -math.atan2(db.y, db.x))
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(HDRI_PATH, check_existing=True)
        cl = nt.nodes.new("ShaderNodeVectorMath"); cl.operation = "MINIMUM"
        cl.inputs[1].default_value = (HDRI_CLAMP, HDRI_CLAMP, HDRI_CLAMP)
        bgh = nt.nodes.new("ShaderNodeBackground"); bgh.inputs["Strength"].default_value = HDRI_STRENGTH
        lp = nt.nodes.new("ShaderNodeLightPath")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(coord.outputs["Generated"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
        nt.links.new(env.outputs["Color"], cl.inputs[0])
        nt.links.new(cl.outputs["Vector"], bgh.inputs["Color"])
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
        nt.links.new(bgh.outputs[0], mix.inputs[1])
        nt.links.new(bg.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
    else:
        nt.links.new(bg.outputs[0], out.inputs[0])
    scene.view_settings.exposure = -0.3
    setup_haze(scene)
    return sun


# ----------------------------------------------------------------------------- build
def build(render=False):
    if SCENE_NAME in bpy.data.scenes:
        old = bpy.data.scenes[SCENE_NAME]
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        for c in list(old.collection.children_recursive):
            bpy.data.collections.remove(c)
        scene = old
    else:
        scene = bpy.data.scenes.new(SCENE_NAME)
    if bpy.context.window:
        bpy.context.window.scene = scene
    root = scene.collection
    colls = {}
    for name in ("hero", "entry", "city", "ground", "planting", "cars", "far", "rig"):
        c = bpy.data.collections.new(f"SKY_{name}")
        root.children.link(c)
        colls[name] = c
    mats = make_materials()
    B = Batch()
    plant, trees, cars = [], [], []
    build_hero(B, plant, trees)
    build_district(B, plant)
    build_ground(B, trees, cars)
    cars.clear()  # no vehicles in the landscape (2026-11-05 direction)
    build_outer_park(B, trees)
    build_far(B)
    scatter_planters(plant, trees)
    objs = B.finish(mats, colls)

    # instanced planting / cars: linked duplicates under one parent per mesh
    sp = species_meshes(mats)
    roots = {}
    if TREE_KIT:
        trees[:] = [(KIT_TREE.get(t[0], t[0]),) + tuple(t[1:]) for t in trees]
        # park + outer-park trees (ground level, in the park or west of the modelled ground)
        grove_i = [i for i, t in enumerate(trees) if t[0] == "ash" and t[2] < .5 and (t[3] >= PARK_Z0 or t[1] < GX0)]
        n_ash = sum(1 for t in trees if t[0] == "ash")
        drop = n_ash - TREE_LIMIT
        if drop > 0:
            rk = random.Random(77)
            keys = {i: rk.random() for i in grove_i}   # own seed: no other random sequence changes
            gone = set(sorted(grove_i, key=keys.get)[:drop])
            trees[:] = [t for i, t in enumerate(trees) if i not in gone]
    for kind, x, y, z, s, rot in trees:
        if kind not in roots:
            e = bpy.data.objects.new(f"TREES_{kind}", None)
            colls["planting"].objects.link(e)
            roots[kind] = e
        ob = bpy.data.objects.new(f"tree_{kind}", sp[kind])
        ob.location = T(x, y, z)
        ob.rotation_euler = (0, 0, rot)
        ob.scale = (s, s, s)
        ob.parent = roots[kind]
        colls["planting"].objects.link(ob)
    if cars:
        cm = car_meshes(mats)
        croot = bpy.data.objects.new("CARS", None)
        colls["cars"].objects.link(croot)
    for col, x, z, rot in cars:
        ob = bpy.data.objects.new(f"car_{col}", cm[col])
        ob.location = T(x, 0, z)
        ob.rotation_euler = (0, 0, rot)
        ob.parent = croot
        colls["cars"].objects.link(ob)

    sun = setup_world_and_light(scene, colls["rig"])
    # the website's establishing shots (rig.js KEYS)
    cams = [
        cam_from_key("CAM_day", (40, 166, 4), 94, .6, 700, 28, .22, coll=colls["rig"]),
        cam_from_key("CAM_dusk", (46, 128, 8), 80, 3, 610, 30, .18, coll=colls["rig"]),
        cam_from_key("CAM_scan", (40, 92, 0), 63, 14, 600, 33, .15, coll=colls["rig"]),
        cam_from_key("CAM_network", (70, 6, 30), 36, 30, 450, 36, .12, coll=colls["rig"]),
        cam_from_key("CAM_portrait", (72, 112, 18), 94, .6, 600, 28 * 1.3, 0, coll=colls["rig"]),
    ]
    scene.camera = cams[0]
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        pass
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    tri_inst = sum(sum(len(p.vertices) - 2 for p in sp[k].polygons) for k, *_ in trees)
    print(f"built: {len(objs)} batched objects, {tri} tris; {len(trees)} plants ({tri_inst} instanced tris); {len(cars)} cars")
    return scene


# ----------------------------------------------------------------------------- far city (preview / posters only)
def build_far(B):
    """Ground to the horizon and simple outer massing, mirroring filler.js placement rules.
    The web runtime keeps its own instanced filler; this collection is not exported."""
    g = "far"
    B.box(g, "ground_far", -2400, 2400, -0.7, -0.05, -2400, 2400, faces=("+y",))
    r = random.Random(7)
    kits = [("concrete_warm", "glass_grey"), ("concrete_light", "glass_blue"), ("concrete_grey", "glass_blue"), ("concrete_sand", "glass_warm")]
    n, guard = 0, 0
    while n < 520 and guard < 20000:
        guard += 1
        ang = r.random() * math.pi * 2
        dist = 300 + (r.random() ** 0.75) * 1300
        x, z = math.cos(ang) * dist, math.sin(ang) * dist
        if GX0 - 10 < x < GX1 + 10 and GZ0 - 10 < z < GZ1 + 10:
            continue
        if x > 60 and abs(z) < 720:
            continue  # nothing between the camera and the skyline
        far = (dist - 300) / 1300
        h = snap((18 + r.random() * 80) * (1 - far * 0.5))
        w, d = 18 + r.random() * 26, 18 + r.random() * 26
        wall, glass = kits[n % len(kits)]
        x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
        B.box(g, glass, x0 + .6, x1 - .6, 0, h, z0 + .6, z1 - .6, faces=("+x", "-x", "+z", "-z"))
        for y in frange(0, h - .1, FH * (2 if far > .5 else 1)):
            ring_bands(B, g, wall, x0 + .6, x1 - .6, z0 + .6, z1 - .6, y, .8, .5)
        B.box(g, "roof_membrane", x0, x1, h - .2, h, z0, z1, faces=("+y",))
        n += 1
    # low-rise carpet in front of the skyline (filler.js 'low' blocks), seen past the boulevard
    for gx in frange(250, 700, 58):
        for gz in frange(-520, 520, 54):
            if r.random() < .22:
                continue
            w, d, h = 22 + r.random() * 22, 20 + r.random() * 20, snap(7 + r.random() * 16 * (2.2 if r.random() < .15 else 1))
            wall, glass = kits[int(gx + gz) % len(kits)]
            x0, z0 = gx + r.random() * 8, gz + r.random() * 8
            B.box(g, glass, x0 + .5, x0 + w - .5, 0, h, z0 + .5, z0 + d - .5, faces=("+x", "-x", "+z", "-z"))
            for y in frange(0, h - .1, FH):
                ring_bands(B, g, wall, x0 + .5, x0 + w - .5, z0 + .5, z0 + d - .5, y, .7, .4)
            B.box(g, "roof_gravel", x0, x0 + w, h - .2, h, z0, z0 + d, faces=("+y",))


def setup_haze(scene, start=160.0, depth=1700.0, amount=0.72, color=(0.74, 0.81, 0.89)):
    """Aerial perspective for posters: mist pass blended toward the runtime fog tone.
    (An EEVEE world volume blacks out the sky, so haze is composited.)"""
    w = scene.world
    w.mist_settings.start, w.mist_settings.depth = start, depth
    w.mist_settings.falloff = "QUADRATIC"
    for vl in scene.view_layers:
        vl.use_pass_mist = True
        vl.use_pass_z = True
    ng = bpy.data.node_groups.get("TAMIRA_haze") or bpy.data.node_groups.new("TAMIRA_haze", "CompositorNodeTree")
    for n in list(ng.nodes):
        ng.nodes.remove(n)
    if not any(i.name == "Image" for i in ng.interface.items_tree):
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    rl.scene = scene
    k = ng.nodes.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = amount
    mix = ng.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs["B"].default_value = (*color, 1)
    out = ng.nodes.new("NodeGroupOutput")
    # keep the sky itself clean: only geometry nearer than 6 km takes haze
    geo = ng.nodes.new("ShaderNodeMath"); geo.operation = "LESS_THAN"; geo.inputs[1].default_value = 6000.0
    k2 = ng.nodes.new("ShaderNodeMath"); k2.operation = "MULTIPLY"
    ng.links.new(rl.outputs["Depth"], geo.inputs[0])
    ng.links.new(rl.outputs["Mist"], k.inputs[0])
    ng.links.new(k.outputs[0], k2.inputs[0])
    ng.links.new(geo.outputs[0], k2.inputs[1])
    ng.links.new(k2.outputs[0], mix.inputs["Factor"])
    ng.links.new(rl.outputs["Image"], mix.inputs["A"])
    ng.links.new(mix.outputs["Result"], out.inputs[0])
    scene.compositing_node_group = ng
    scene.render.use_compositing = True


# ----------------------------------------------------------------------------- web export
WEB_COLLECTIONS = ("hero", "entry", "city", "ground", "planting", "cars")


def export_web(path, scene_name=SCENE_NAME):
    """GLB for src/story/skyline: no images (constant PBR factors per material class; the TEXTURED
    materials carry their box UVs and index.js adds the textures), flat normals, Y-up, linked
    planting/cars as EXT_mesh_gpu_instancing."""
    scene = bpy.data.scenes[scene_name]
    if bpy.context.window:
        bpy.context.window.scene = scene
    vl = scene.view_layers[0]
    for lc in vl.layer_collection.children:
        lc.exclude = lc.name.replace("SKY_", "") not in WEB_COLLECTIONS
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_visible=True, export_yup=True, export_apply=True,
        export_normals=True, export_texcoords=True, export_tangents=False, export_materials="EXPORT",
        export_vertex_color="NONE", export_cameras=False, export_lights=False, export_extras=False,
        export_gpu_instances=True, export_draco_mesh_compression_enable=False, export_animations=False,
        use_active_scene=True)
    for lc in vl.layer_collection.children:
        lc.exclude = False
    print("exported", path)
