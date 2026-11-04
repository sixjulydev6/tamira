"""Tamira city hero: clay / satin-ceramic daylight still.

Builds the hero city from scratch and renders it with Cycles. The layout, crown and camera are a
straight port of tamira-reference-match/blender/hero_day.py (style v1), so the website's wireframe
(src/story/city.js) still lands on the new render. Only the finish changes: bevels and normals,
materials, light rig, focus and colour pipeline (see prompt.md / docs/REFERENCES-AND-ASSETS.md).

Run headless (Blender 5.2, any OS):
    blender -b --python build_city.py -- <out_dir> [samples] [res_pct] [overrides]

    samples    Cycles samples (default 384)
    res_pct    % of the 3840x2160 master (default 100)
    overrides  comma-separated key=value look-dev knobs, for example
               "sun=4.6,world=0.30,exposure=0.1,dof=0" (see LOOK below)

Writes to <out_dir>:
    hero-city.exr          linear scene-referred master (half float)
    hero-city.png          display-referred master (AgX, 16-bit)
    hero-city.jpg          quick-look JPEG
    crop-*.png             review crops: crown notch, white roof/windows, ground contact
    city-layout.json       camera, buildings, crown, roads, trees and projected anchors
    tamira-city.blend      the scene, saved before rendering

Deterministic: every random choice is seeded; same inputs give the same scene.
Z up, metres, crown base centre at the origin (same convention as src/story/city.js).
"""
import bpy, bmesh, math, sys, os, random, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.expanduser("~"), "tamira_city")
SAMPLES = int(argv[1]) if len(argv) > 1 else 384
RES_PCT = int(argv[2]) if len(argv) > 2 else 100

# ------------------------------------------------------------------ look-dev knobs
# Defaults are the approved look (review rounds r01–r05 in docs/REFERENCES-AND-ASSETS.md);
# the brief's starting values are noted where they moved.
LOOK = {
    "sun": 5.2,          # key irradiance (W/m²), Blender sun
    "sun_angle": 3.0,    # key apparent size in degrees: sets the penumbra width (crisp, dramatic edges)
    "sun_el": 30.0,      # key elevation: low sun, long raking shadows (was 42)
    "world": 0.13,       # sky fill strength, neutral-cool: low fill = deep shadow faces (client: "more dramatic")
    "exposure": 0.0,     # AgX exposure
    "look": "mhc",       # AgX look: base | mhc (medium high contrast) | punchy
    "bevel": 0.022,      # building bevel as a fraction of the smaller footprint side (started at
    "bevel_min": 0.45,   # 1%: highlights vanished at CSS display size) clamped to this range (m)
    "bevel_max": 1.4,
    "crown_bevel": 0.60, # crown bevel (m), ~1% of its 62 m diameter; notches stay sharp
    "raise": 0.14,       # windows stand this far proud of the facade (m)
    "dof": 0.0,          # f-stop for orthographic DOF; 0 = off
    "bounce": 0.0,       # optional warm point light at the crown base (W); 0 = rely on GI bounce
    "dots": 6.0,         # street-dot emission strength
}
# mode: still (default, the hero image) | anim (traffic loop, see animate_city.py) | probe (build only)
MODE = argv[4] if len(argv) > 4 else "still"
if len(argv) > 3 and argv[3]:
    for kv in argv[3].split(","):
        k, v = kv.split("=")
        LOOK[k] = v if k == "look" else float(v)
print("LOOK", LOOK)

os.makedirs(OUT, exist_ok=True)
rng = random.Random(2718)

# ------------------------------------------------------------------ camera model (from hero_day.py)
# Orthographic, elevation 38°, plan azimuth −45° (camera in +X/−Y quadrant), roll 0.
EL = math.radians(38.0)
AZ = math.radians(-45.0)
S = 400.0                       # ortho scale = frame width in metres (sensor fit horizontal)
REF_W, REF_H = 2000.0, 1122.0   # reference pixel space used for all anchors below
K = REF_W / S                   # reference px per metre
CROWN_FY = 740.0 / REF_H        # crown base centre sits here in the frame
RIGHT = Vector((-math.sin(AZ), math.cos(AZ), 0.0))      # screen-right on the ground
AWAY = Vector((-math.cos(AZ), -math.sin(AZ), 0.0))      # into the picture on the ground
TO_CAM = Vector((math.cos(EL) * math.cos(AZ), math.cos(EL) * math.sin(AZ), math.sin(EL)))
RES_X, RES_Y = 3840, 2160       # same 16:9 aspect as the 1920x1080 frame the site is aligned to;
                                # 4K so Retina screens (which need up to ~3700 px) never upscale it


def ground_at(px, py):
    """reference pixel (2000x1122 space) -> ground point (z=0); crown base centre = origin"""
    fx, fy = px / REF_W, py / REF_H
    return (RIGHT * ((fx - 0.5) * S)) + (AWAY * (((CROWN_FY - fy) * S * REF_H / REF_W) / math.sin(EL)))


# ------------------------------------------------------------------ reset scene
# (keep user preferences so the GPU device settings survive; just empty the startup scene)
scene = bpy.context.scene
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for c_ in list(bpy.data.collections): bpy.data.collections.remove(c_)
for m_ in list(bpy.data.materials): bpy.data.materials.remove(m_)
try:
    import addon_utils; addon_utils.enable("cycles", default_set=True)
except Exception as e:
    print("cycles enable:", e)
scene.name = "Tamira_City_Clay"


def coll(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c


C = {n: coll(n) for n in ["LandmarkCrownTower", "PaleBuildings", "WindowSurfaces", "GroundAndStreets",
                          "TreesAndSmallDetails", "DayLightRig", "HeroCamera"]}


# ------------------------------------------------------------------ materials
def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def principled(name, hexcol, rough, ior=1.46, emit=None, emit_strength=0.0, rough_var=0.03):
    """satin dielectric: metallic 0, coat 0, no transmission/SSS.
    rough_var adds a very low-frequency ±roughness drift so broad faces don't read as CG-uniform."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["IOR"].default_value = ior
    if rough_var > 0:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.035; nz.inputs["Detail"].default_value = 1.0
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = rough - rough_var; mr.inputs["To Max"].default_value = rough + rough_var
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


M = {
    # neutral city: white satin ceramic
    "white":     principled("M_Ceramic", "#E5E5E1", 0.46),
    "white2":    principled("M_CeramicCool", "#DFE0DF", 0.48),
    "grey":      principled("M_CeramicGrey", "#B4B4B7", 0.48),
    # crown: saturated coated clay
    "orange":    principled("M_CrownClay", "#E85C2D", 0.38),
    "orangeTop": principled("M_CrownClayTop", "#F3A27C", 0.42),
    # roofs / windows: restrained charcoal and greys, never black voids
    "roof":      principled("M_RoofCharcoal", "#4A4954", 0.45),
    "paneW":     principled("M_PaneGrey", "#AEAFB4", 0.40, rough_var=0),
    "paneW2":    principled("M_PaneGreyDark", "#9A9BA1", 0.40, rough_var=0),
    "paneWarm":  principled("M_PaneWarm", "#C99083", 0.40, rough_var=0),
    "paneO":     principled("M_PaneOnCrown", "#F6A97F", 0.42, rough_var=0),
    # support
    "ground":    principled("M_Ground", "#E8E9E7", 0.72, rough_var=0.04),
    "road":      principled("M_Road", "#C9CACD", 0.62),
    "tree":      principled("M_TreeCeramic", "#E4E2DE", 0.56),
    "car":       principled("M_Car", "#E8E8E8", 0.42, rough_var=0),
    "carD":      principled("M_CarDark", "#55555C", 0.42, rough_var=0),
    "dot":       principled("M_StreetDot", "#FFC27A", 0.5, emit=(1.0, 0.68, 0.33), emit_strength=LOOK["dots"], rough_var=0),
}


# ------------------------------------------------------------------ mesh helpers
def link(obj, c): c.objects.link(obj); return obj


def planar_normals(ob):
    """smooth bevels, planar broad faces: weighted (face-area) normals keep the facades flat
    while the bevel rounds catch one continuous highlight."""
    wn = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    wn.mode = "FACE_AREA"; wn.weight = 100; wn.keep_sharp = True
    return ob


def rounded_box(name, w, d, h, bevel, mats, roof_inset=False, c=None, loc=(0, 0, 0), segments=5):
    """bevelled box, base at z=0; material 0 = walls; optional top face roof material (index 1)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * d, v.co.z * h + h / 2))   # scale applied before bevel
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, profile=0.5, affect='EDGES', clamp_overlap=True)
    for f in bm.faces:
        f.smooth = True
        f.material_index = 1 if (roof_inset and f.normal.z > 0.99 and f.calc_center_median().z > h - 0.01) else 0
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); ob.location = loc
    planar_normals(ob)
    return link(ob, c)


RAISE = LOOK["raise"]


class PaneBuilder:
    """collects many small window boxes into one mesh per material (instancing-by-batching:
    a handful of meshes instead of thousands of objects/materials)"""
    def __init__(self): self.parts = {}

    def add(self, mat, center, axis_u, normal, size, depth=0.25, height=None):
        hgt = height or size
        self.parts.setdefault(mat, []).append((Vector(center), Vector(axis_u).normalized(), Vector(normal).normalized(), size, hgt, depth))

    def build(self, c):
        for mat, items in self.parts.items():
            verts, faces = [], []
            for (ce, u, n, s, hg, dp) in items:
                z = Vector((0, 0, 1)); base = len(verts)
                for dz in (-hg / 2, hg / 2):
                    for du in (-s / 2, s / 2):
                        for dn in (-dp, RAISE):          # a shallow raised inset, not a printed square
                            verts.append(ce + u * du + z * dz + n * dn)
                q = lambda a, b, cc, d: faces.append((base + a, base + b, base + cc, base + d))
                q(0, 2, 6, 4); q(1, 5, 7, 3); q(0, 1, 3, 2); q(4, 6, 7, 5); q(0, 4, 5, 1); q(2, 3, 7, 6)
            me = bpy.data.meshes.new("Panes_" + mat.name); me.from_pydata([tuple(v) for v in verts], [], faces)
            me.update(); me.validate()
            bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
            me.materials.append(mat)
            link(bpy.data.objects.new("Windows_" + mat.name, me), c)


panes = PaneBuilder()


def facade_windows(cx, cy, w, d, h, pal, pitch=4.6, size=2.5, start=4.5, top_margin=3.5, faces=("-Y", "+X"), skip=0.0, cols=None, bid="b"):
    """windows on the two camera-facing faces (−Y face spans X, +X face spans Y)"""
    for f in faces:
        if f == "-Y": span, n, u, ctr = w, Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((cx, cy - d / 2, 0))
        else:         span, n, u, ctr = d, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((cx + w / 2, cy, 0))
        nc = cols or max(1, int((span - 4.0) // pitch) + 1)
        z = start
        while z < h - top_margin:
            for i in range(nc):
                if rng.random() < skip: continue
                off = (i - (nc - 1) / 2) * pitch
                panes.add(rng.choice(pal), ctr + u * off + Vector((0, 0, z)), u, n, size)
            z += pitch


# ------------------------------------------------------------------ crown landmark (six notched arms)
CROWN_H, CROWN_R = 132.0, 31.0
ARM_W, R_IN, NOTCH = 17.0, 11.0, 6.5
CROWN_POLYS = []


def build_crown():
    """The six arms are the same notched rectangles as hero_day.py, but modelled as ONE solid
    (their plan union, with the hexagonal opening as a hole) so the arm junctions are resolved
    instead of six intersecting prisms z-fighting at the top."""
    def polar(r, deg): return Vector((r * math.cos(math.radians(deg)), r * math.sin(math.radians(deg)), 0))
    # adjacent arm sides meet on the bisector at radius (ARM_W/2) / sin 30°; the arms' inner ends
    # form a hexagon of apothem R_IN (vertices on the bisectors)
    r_join = (ARM_W / 2) / math.sin(math.radians(30))
    r_hex = R_IN / math.cos(math.radians(30))
    bm = bmesh.new()
    for k in range(6):
        a = -45 + 60 * k
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        rot = lambda u, v: Vector((u * ca - v * sa, u * sa + v * ca, 0))
        sector = [polar(r_hex, a - 30), polar(r_join, a - 30), rot(CROWN_R, -ARM_W / 2), rot(CROWN_R - NOTCH, 0),
                  rot(CROWN_R, ARM_W / 2), polar(r_join, a + 30), polar(r_hex, a + 30)]
        bm.faces.new([bm.verts.new(p) for p in sector])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    base = list(bm.faces)
    ext = bmesh.ops.extrude_face_region(bm, geom=base)
    bmesh.ops.translate(bm, verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, CROWN_H))
    bmesh.ops.delete(bm, geom=base, context='FACES_ONLY')      # base sits on the ground, never seen
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # bevel only real corners: the seams between the coplanar sector faces on the cap stay flat
    corners = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(5)]
    bmesh.ops.bevel(bm, geom=corners, offset=LOOK["crown_bevel"], segments=4, profile=0.5, affect='EDGES', clamp_overlap=True)
    for f in bm.faces:
        f.smooth = True
        f.material_index = 1 if (f.normal.z > 0.99 and f.calc_center_median().z > CROWN_H - 0.05) else 0
    me = bpy.data.meshes.new("CrownTower"); bm.to_mesh(me); bm.free()
    me.materials.append(M["orange"]); me.materials.append(M["orangeTop"])
    planar_normals(link(bpy.data.objects.new("CrownTower", me), C["LandmarkCrownTower"]))

    for k in range(6):
        a = math.radians(-45 + 60 * k)
        ca, sa = math.cos(a), math.sin(a)
        rot = lambda u, v: Vector((u * ca - v * sa, u * sa + v * ca, 0))
        # plan polygon of one arm: rectangle with a V-notch cut into its outer end
        poly = [rot(R_IN, -ARM_W / 2), rot(CROWN_R, -ARM_W / 2), rot(CROWN_R - NOTCH, 0), rot(CROWN_R, ARM_W / 2), rot(R_IN, ARM_W / 2)]
        CROWN_POLYS.append([tuple(round(c, 4) for c in p[:2]) for p in poly])
        # windows: a column on each face of the notched end + one on each long side
        for (p, q_) in [(poly[1], poly[2]), (poly[2], poly[3])]:
            mid = (p + q_) / 2; u = (q_ - p).normalized(); n = Vector((u.y, -u.x, 0))
            if n.dot(mid) < 0: n = -n
            z = 8.0
            while z < CROWN_H - 6:
                panes.add(M["paneO"], mid + n * 0.02 + Vector((0, 0, z)), u, n, 2.6, height=2.9); z += 7.0
        for (p, q_) in [(poly[0], poly[1]), (poly[3], poly[4])]:
            mid = p.lerp(q_, 0.62); u = (q_ - p).normalized(); n = Vector((u.y, -u.x, 0))
            arm_dir = Vector((ca, sa, 0)); side = mid - arm_dir * mid.dot(arm_dir)   # outward = away from the arm centreline
            if n.dot(side) < 0: n = -n
            z = 11.5
            while z < CROWN_H - 6:
                panes.add(M["paneO"], mid + n * 0.02 + Vector((0, 0, z)), u, n, 2.4, height=2.7); z += 7.0
    core = rounded_box("CrownCore", 25, 25, CROWN_H - 14, 0.6, [M["orange"]], c=C["LandmarkCrownTower"])
    core.rotation_euler.z = math.radians(-45)


# ------------------------------------------------------------------ buildings from reference anchors
# (front-corner px, front-corner bottom py, left-face px width, right-face px width, top-of-front-edge py, style, opts)
# Identical to hero_day.py and to BUILDINGS in src/story/city.js. Change all three together.
BUILDINGS = [
    (645, 520, 80, 65, 178, "white", {}),
    (790, 650, 60, 70, 332, "white", {"win": "warm", "faces": ("+X",)}),
    (530, 775, 40, 210, 540, "white", {"win": "cool"}),
    (455, 782, 70, 70, 622, "white", {"win": "cool", "roof": True}),
    (265, 645, 60, 70, 452, "grey2", {"win": "cool"}),
    (70, 605, 65, 60, 528, "white", {}),
    (320, 330, 35, 35, 236, "white", {"roof": True}),
    (655, 800, 65, 70, 692, "white", {"win": "cool"}),
    (915, 795, 80, 85, 702, "white", {}),
    (965, 1062, 85, 90, 757, "white", {"win": "cool", "faces": ("-Y",)}),
    (1130, 977, 65, 65, 752, "white", {"win": "cool", "faces": ("-Y",)}),
    (1115, 762, 65, 70, 702, "taupe", {"roof": True}),
    (830, 932, 50, 50, 806, "white", {"win": "cool"}),
    (720, 972, 80, 90, 887, "white", {"win": "cool"}),
    (295, 967, 70, 75, 872, "white", {"win": "cool", "faces": ("+X",)}),
    (557, 1135, 38, 38, 1032, "white", {"roof": True}),
    (1300, 762, 70, 100, 472, "white", {"win": "cool", "roof": True, "faces": ("+X",)}),
    (1290, 480, 75, 70, 152, "white", {"win": "cool"}),
    (1190, 592, 35, 40, 398, "white", {}),
    (1410, 618, 60, 60, 302, "white", {"win": "cool"}),
    (1575, 362, 40, 40, 262, "grey", {}),
    (1520, 522, 35, 35, 427, "grey", {"roof": True}),
    (1545, 172, 65, 70, 122, "white", {}),
    (1785, 192, 30, 30, 97, "white", {}),
    (1855, 572, 40, 45, 507, "white", {}),
    (1490, 762, 70, 70, 572, "white", {"win": "cool"}),
    (1390, 822, 70, 70, 662, "white", {"win": "cool"}),
    (1480, 892, 75, 75, 802, "white", {"win": "cool"}),
    (1720, 812, 65, 70, 737, "white", {}),
    (1880, 1022, 75, 70, 747, "white", {}),
    (1650, 1190, 105, 120, 862, "white", {"win": "cool"}),
    (1835, 1062, 45, 45, 947, "white", {}),
    (1478, 1027, 38, 38, 917, "grey", {"roof": True}),
    (1325, 962, 55, 55, 912, "white", {"win": "cool"}),
    (1255, 922, 55, 55, 787, "white", {"win": "cool"}),
    (585, 40, 70, 75, 0, "white", {}),
]

WALL = {"white": "white", "grey": "grey", "grey2": "white2", "taupe": "grey"}
PAL = {"cool": [M["paneW"], M["paneW"], M["paneW2"]], "warm": [M["paneWarm"], M["paneW"], M["paneWarm"]]}
LAYOUT = {"buildings": [], "roads": [], "trees": []}


def build_buildings():
    for (px, py, lw, rw, ty, style, opt) in BUILDINGS:
        corner = ground_at(px, py)
        dim_x = lw / (K * 0.7071)
        dim_y = rw / (K * 0.7071)
        h = max(5.0, (py - ty) / K / math.cos(EL))
        cx, cy = corner.x - dim_x / 2, corner.y + dim_y / 2
        bev = min(LOOK["bevel_max"], max(LOOK["bevel_min"], LOOK["bevel"] * min(dim_x, dim_y)))
        bid = f"B_{px}_{py}"
        rounded_box(bid, dim_x, dim_y, h, bev, [M[WALL[style]], M["roof"]], roof_inset=opt.get("roof", False),
                    c=C["PaleBuildings"], loc=(cx, cy, 0))
        LAYOUT["buildings"].append({"id": bid, "centre": [round(cx, 3), round(cy, 3)], "size": [round(dim_x, 3), round(dim_y, 3), round(h, 3)],
                                    "bevel": round(bev, 3), "style": style, "darkRoof": bool(opt.get("roof")), "windows": opt.get("win")})
        if opt.get("win"):
            facade_windows(cx, cy, dim_x, dim_y, h, PAL[opt["win"]], faces=opt.get("faces", ("-Y", "+X")), bid=bid)


# ------------------------------------------------------------------ ground, streets, small details
def build_ground():
    me = bpy.data.meshes.new("Ground")
    me.from_pydata([(-3000, -3000, 0), (3000, -3000, 0), (3000, 3000, 0), (-3000, 3000, 0)], [], [(0, 1, 2, 3)])
    me.materials.append(M["ground"])
    link(bpy.data.objects.new("Ground", me), C["GroundAndStreets"])


ROAD_SEGS = [((-60, 830), (300, 668)), ((300, 668), (585, 885)), ((585, 885), (900, 745)), ((585, 885), (760, 1180)),
             ((1690, 545), (2080, 720)), ((1690, 545), (2050, 360)), ((300, 0), (840, 262)), ((1130, 135), (1420, -10)),
             ((1050, 985), (1480, 1100))]
ROAD_W = 11.0


def sphere(radius, loc, mat, c, segs=10, rings=6):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new("Sphere"); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = bpy.data.objects.new("Sphere", me); ob.location = loc; return link(ob, c)


def cylinder(radius, depth, loc, mat, c, verts=10):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=radius, radius2=radius, depth=depth)
    me = bpy.data.meshes.new("Cyl"); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = bpy.data.objects.new("Cyl", me); ob.location = loc; return link(ob, c)


def build_roads():
    for i, (a_px, b_px) in enumerate(ROAD_SEGS):
        a, b = ground_at(*a_px), ground_at(*b_px)
        dv = b - a
        along = "X" if abs(dv.x) > abs(dv.y) else "Y"
        mid = (a + b) / 2; L = (abs(dv.x) if along == "X" else abs(dv.y)) + ROAD_W
        if along == "Y": w, d = ROAD_W, L
        else:            w, d = L, ROAD_W
        p = mid
        # where two streets cross, their tops must not be coplanar (Cycles shades coincident faces black)
        road = rounded_box(f"Road_{along}_{a_px[0]}", w, d, 0.06 + 0.012 * i, 0.02, [M["road"]], c=C["GroundAndStreets"], loc=(mid.x, mid.y, 0), segments=1)
        road.modifiers.clear()
        LAYOUT["roads"].append({"centre": [round(mid.x, 3), round(mid.y, 3)], "size": [round(w, 3), round(d, 3)], "along": along})
        n_steps = int(L / 2 / 9.0)
        # warm street dots along both edges, sparse, plus a few cars (same rng draws as hero_day.py)
        for s in range(-n_steps, n_steps + 1):
            t = s * 9.0
            if rng.random() < 0.35: continue
            for side in (-1, 1):
                if rng.random() < 0.5: continue
                off = side * (ROAD_W / 2 + 0.9)
                pos = Vector((p.x + (off if along == "Y" else t), p.y + (t if along == "Y" else off), 0.35))
                sphere(0.45, pos, M["dot"], C["TreesAndSmallDetails"])
            if rng.random() < 0.25:
                lane = rng.choice((-2.6, 2.6))
                pos = (p.x + (lane if along == "Y" else t), p.y + (t if along == "Y" else lane), 0)
                dims = (1.9, 4.2) if along == "Y" else (4.2, 1.9)
                mat = rng.choice([M["car"], M["car"], M["carD"]])   # drawn in every mode: keeps the rng sequence
                if MODE == "still":                                 # anim mode drives its own cars instead
                    rounded_box("Car", dims[0], dims[1], 1.5, 0.45, [mat], c=C["TreesAndSmallDetails"], loc=pos, segments=3)


TREES = [(90, 165), (915, 45), (465, 570), (780, 672), (165, 645), (205, 632), (95, 705), (30, 872), (470, 785),
         (470, 990), (770, 992), (1085, 1012), (1230, 942), (1290, 1092), (1595, 815), (1670, 602), (1640, 207), (1925, 337)]


def build_trees():
    for (px, py) in TREES:
        p = ground_at(px, py); r = rng.uniform(2.6, 3.6)
        sphere(r, (p.x, p.y, 4.2 + r * 0.8), M["tree"], C["TreesAndSmallDetails"], segs=32, rings=16)
        cylinder(0.28, 4.4, (p.x, p.y, 2.2), M["tree"], C["TreesAndSmallDetails"])
        LAYOUT["trees"].append({"at": [round(p.x, 3), round(p.y, 3)], "r": round(r, 3)})


# ------------------------------------------------------------------ camera + light rig
def build_camera():
    cam_d = bpy.data.cameras.new("HeroCamera")
    cam_d.type = 'ORTHO'; cam_d.ortho_scale = S; cam_d.sensor_fit = 'HORIZONTAL'
    cam_d.clip_start = 1; cam_d.clip_end = 6000
    cam = bpy.data.objects.new("HeroCamera", cam_d); C["HeroCamera"].objects.link(cam)
    centre = ground_at(REF_W / 2, REF_H / 2)
    cam.location = centre + TO_CAM * 1500
    cam.rotation_euler = (-TO_CAM).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    # focus: off by default. The crown, its orange facade and its neighbours must stay sharp;
    # a small f-stop only softens the far edges once materials are approved.
    focus = bpy.data.objects.new("FocusTarget", None); focus.location = (0, 0, 55); C["HeroCamera"].objects.link(focus)
    cam_d.dof.use_dof = LOOK["dof"] > 0
    cam_d.dof.focus_object = focus
    if LOOK["dof"] > 0: cam_d.dof.aperture_fstop = LOOK["dof"]
    return cam


def build_lights():
    # key: one dominant soft sun from camera-left, slightly behind → shadows fall screen-right.
    # Its angle sets a readable penumbra; it is the only shadow direction in the frame.
    sun_d = bpy.data.lights.new("KeySun", 'SUN'); sun_d.energy = LOOK["sun"]; sun_d.angle = math.radians(LOOK["sun_angle"])
    sun_d.color = (1.0, 0.97, 0.93)
    sun = bpy.data.objects.new("KeySun", sun_d); C["DayLightRig"].objects.link(sun)
    to_light = (-RIGHT * 0.95 + AWAY * 0.35).normalized()
    elev = math.radians(LOOK["sun_el"])
    d = Vector((to_light.x * math.cos(elev), to_light.y * math.cos(elev), math.sin(elev)))
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    # weak neutral-cool sky fill (≈ a quarter of the key at the subject)
    w = bpy.data.worlds.new("DayWorld"); scene.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*srgb("#E6E9EE"), 1); bg.inputs["Strength"].default_value = LOOK["world"]
    if LOOK["bounce"] > 0:   # optional warm spill at the crown base; GI bounce usually carries it
        gl = bpy.data.lights.new("CrownBounce", "POINT"); gl.energy = LOOK["bounce"]; gl.color = (1.0, 0.5, 0.3); gl.shadow_soft_size = 18
        glo = bpy.data.objects.new("CrownBounce", gl); glo.location = ground_at(1000, 760) + Vector((0, 0, 10)); C["DayLightRig"].objects.link(glo)


# ------------------------------------------------------------------ render settings
def setup_render():
    scene.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for t in ("OPTIX", "CUDA", "METAL", "HIP", "ONEAPI"):   # dynamic enum: try each backend
            try:
                prefs.compute_device_type = t
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [dv for dv in prefs.devices if dv.type == t]
            if gpus:
                for dv in prefs.devices: dv.use = dv.type == t
                scene.cycles.device = 'GPU'; print("GPU", t, [g.name for g in gpus], flush=True); break
        else:
            print("no GPU backend, rendering on CPU", flush=True)
    except Exception as e:
        print("GPU setup failed, CPU fallback:", e)
    cy = scene.cycles
    cy.samples = SAMPLES
    cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.01
    cy.use_denoising = True
    cy.max_bounces = 8; cy.diffuse_bounces = 4; cy.glossy_bounces = 4
    cy.transmission_bounces = 0; cy.volume_bounces = 0; cy.transparent_max_bounces = 4
    cy.seed = 7
    scene.render.resolution_x, scene.render.resolution_y = RES_X, RES_Y
    scene.render.resolution_percentage = RES_PCT
    scene.render.film_transparent = False
    vs = scene.view_settings
    # view/look are dynamic (OCIO) enums: assign and let Blender list the valid names on failure
    try:
        vs.view_transform = 'AgX'
    except TypeError as e:
        print("AgX unavailable:", e)
    want = {"base": "AgX - Base Contrast", "mhc": "AgX - Medium High Contrast", "punchy": "AgX - Punchy"}.get(LOOK["look"], "None")
    try:
        vs.look = want
    except TypeError as e:
        print("look unavailable:", e); vs.look = 'None'
    vs.exposure = LOOK["exposure"]; vs.gamma = 1.0
    print("view", vs.view_transform, vs.look, vs.exposure)


# ------------------------------------------------------------------ manifest: camera, layout, projected anchors
def write_manifest():
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()          # camera matrix_world is stale until the depsgraph updates
    cam = scene.camera
    def px(p):   # → pixels in the 1920x1080 frame the website aligns to (origin top-left)
        v = world_to_camera_view(scene, cam, Vector(p))
        return [round(v.x * 1920, 2), round((1 - v.y) * 1080, 2)]
    anchors = {"crownTop": (0, 0, CROWN_H), "crownBase": (0, 0, 0)}
    for b in LAYOUT["buildings"]:
        if b["id"] in ("B_965_1062", "B_1300_762", "B_645_520", "B_455_782"):
            (cx, cy), (dx, dy, h) = b["centre"], b["size"]
            anchors[b["id"] + ".roofFrontCorner"] = (cx + dx / 2, cy - dy / 2, h)
    data = {
        "units": "metres", "up": "+Z", "origin": "crown base centre",
        "source": "art/blender/build_city.py (layout identical to hero_day.py / src/story/city.js)",
        "camera": {"projection": "orthographic", "elevationDeg": 38, "azimuthDeg": -45, "rollDeg": 0,
                   "frameWidthM": S, "sensorFit": "horizontal", "location": [round(c, 4) for c in cam.location],
                   "target": [round(c, 4) for c in ground_at(REF_W / 2, REF_H / 2)], "render": [RES_X, RES_Y], "aspect": RES_X / RES_Y},
        "crown": {"height": CROWN_H, "radius": CROWN_R, "armWidth": ARM_W, "innerRadius": R_IN, "notch": NOTCH, "armPolys": CROWN_POLYS},
        **LAYOUT,
        "anchorsPx1920": {k: px(v) for k, v in anchors.items()},
        "anchorsWorld": {k: list(v) for k, v in anchors.items()},
        "look": LOOK, "samples": SAMPLES,
        "blender": bpy.app.version_string,
        "colour": {"view": scene.view_settings.view_transform, "look": scene.view_settings.look, "exposure": scene.view_settings.exposure},
    }
    with open(os.path.join(OUT, "city-layout.json"), "w") as f: json.dump(data, f, indent=1)


# ------------------------------------------------------------------ build + render
build_crown(); build_buildings(); panes.build(C["WindowSurfaces"])
build_ground(); build_roads(); build_trees()
build_camera(); build_lights(); setup_render()


def render_still():
    write_manifest()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "tamira-city.blend"))

    # linear master
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.exr_codec = 'ZIP'
    scene.render.filepath = os.path.join(OUT, "hero-city.exr")
    bpy.ops.render.render(write_still=True)
    rr = bpy.data.images["Render Result"]
    # display-referred masters from the same render (view transform applied on save)
    s = scene.render.image_settings
    s.file_format = 'PNG'; s.color_depth = '16'; s.color_mode = 'RGB'
    rr.save_render(os.path.join(OUT, "hero-city.png"), scene=scene)
    s.file_format = 'JPEG'; s.color_depth = '8'; s.quality = 92
    rr.save_render(os.path.join(OUT, "hero-city.jpg"), scene=scene)

    # review crops (pixel boxes in 2560x1440 space, scaled to the actual output size; origin top-left)
    s.file_format = 'PNG'; s.color_depth = '8'
    img = bpy.data.images.load(os.path.join(OUT, "hero-city.jpg"))   # 8-bit: pixels stay display-referred
    W_, H_ = img.size
    CROPS = {"crown-notch": (1080, 140, 1500, 560), "white-roof-windows": (1560, 460, 1980, 880), "ground-contact": (240, 960, 760, 1380)}
    try:
        import numpy as np
        pxl = np.array(img.pixels[:], dtype=np.float32).reshape(H_, W_, 4)
        f_ = W_ / 2560
        for name, (x0, y0, x1, y1) in CROPS.items():
            X0, X1 = int(x0 * f_), int(x1 * f_); Y0, Y1 = H_ - int(y1 * f_), H_ - int(y0 * f_)
            sub = pxl[Y0:Y1, X0:X1].copy()
            ci = bpy.data.images.new(name, X1 - X0, Y1 - Y0, alpha=True)
            ci.pixels[:] = sub.ravel()
            ci.filepath_raw = os.path.join(OUT, f"crop-{name}.png"); ci.file_format = 'PNG'; ci.save()
    except Exception as e:
        print("crops failed:", e)
    print("DONE", OUT); sys.stdout.flush()


if MODE == "still":
    render_still()
# anim / probe: the scene is built and nothing is rendered; animate_city.py takes over
