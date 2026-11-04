"""Tamira city hero: seamless traffic loop.

Builds the exact hero city with build_city.py (mode "anim": same layout, look and camera, minus
the parked cars) and adds small clay cars driving the streets. The camera and the city never move,
so the wireframe hand-over in src/story/scene.js still lands on every frame.

Run headless (Blender 5.2):
    blender -b --python animate_city.py -- <out_dir> [samples] [width] [job]

    samples  Cycles samples (default 128 for frames, use 384 for the poster)
    width    output width in px, 16:9 (default 2560)
    job      check   print the routes and traffic, check for collisions, save the .blend (no render)
             frames  render the loop as a PNG sequence into <out_dir>/frames (resumable: frames
                     already on disk are skipped, so several machines or restarts can share it)
             frames:A-B  only frames A..B
             poster  render frame 0 as hero-city.png / .jpg (the still the video starts from)
             encode  frames → hero-traffic-<w>.mp4 (H.264) and .webm (AV1) with Blender's FFmpeg

Seamless loop: every car drives at the same speed, and a lane's traffic is one pattern repeated
every SPEED × SECONDS metres along its route, so after one loop every car sits exactly where the
next one started. Routes start and end off-frame or behind a building, where cars wrap unseen.
Static pixels are identical in every frame: the sampling seed is fixed (not animated), so the
noise pattern only changes where a car changes the light.
"""
import bpy, sys, os, math, random, runpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.path.expanduser("~"), "tamira_traffic")
SAMPLES = int(args[1]) if len(args) > 1 else 128
WIDTH = int(args[2]) if len(args) > 2 else 2560
JOB = args[3] if len(args) > 3 else "check"
HERE = os.path.dirname(os.path.abspath(__file__))

# build the city (same scene as the still, no parked cars, nothing rendered)
sys.argv = [sys.argv[0], "--", OUT, str(SAMPLES), "100", "", "anim"]
B = runpy.run_path(os.path.join(HERE, "build_city.py"), run_name="build_city")
scene, M, rounded_box, ground_at = B["scene"], B["M"], B["rounded_box"], B["ground_at"]
TO_CAM = B["TO_CAM"]
bpy.context.view_layer.update()     # the camera's matrix_world is stale until the depsgraph updates

# ------------------------------------------------------------------ traffic knobs
FPS = 24
SECONDS = 10.0
N = int(FPS * SECONDS)          # frames in the loop; frame N == frame 0
SPEED = 11.0                    # m/s (~40 km/h): about 70 px/s on a 2560 px frame
PERIOD = SPEED * SECONDS        # m: each lane's traffic repeats this often along its route
LANE = 2.6                      # lane centre from the road centreline (road is 11 m wide)
KEEP_LEFT = True                # India drives on the left
TURN_R = 4.0                    # corner fillet (m), measured on the lane line
CAR_SCALE = 1.4                 # cars are miniatures: 1:1 they vanish at hero size
DISC = (2.0 * CAR_SCALE / 1.4, 1.45 * CAR_SCALE / 1.4)   # collision: 3 discs at 0, ±offset along the car, radius
OFF_MARGIN = 70                 # px (1920 frame) a wrap point must sit beyond the frame edge
SEED = 1307

# Routes as reference-pixel points (2000×1122 space, the same anchors as ROAD_SEGS in build_city.py).
# "off" = that end is off-frame (it gets extended); "hid" = it ends behind a building (fixed wrap point).
# Each route carries one lane in each direction.
ROUTES = [
    ("west",     [(-60, 830), (300, 668), (585, 885), (760, 1180)], ("off", "off")),
    ("east",     [(2080, 720), (1690, 545), (2050, 360)],            ("off", "off")),
    ("junction", [(-60, 830), (300, 668), (585, 885), (695, 836)],   ("off", "hid")),  # ends behind B_915_795
    ("north",    [(300, 0), (644, 167)],                             ("off", "hid")),  # ends behind the block mid-road
]
# cars per PERIOD window for each route (both lanes): busier on the long west street
DENSITY = {"west": (1, 2), "east": (1, 2), "junction": (1, 1), "north": (1, 1)}
COLOURS = ["car", "carW", "carG", "carD", "carD"]   # 40% charcoal: reads on the pale road without going sombre

M["carW"] = B["principled"]("M_CarWarm", "#EFEBE4", 0.42, rough_var=0)
M["carG"] = B["principled"]("M_CarGrey", "#A9AAAF", 0.42, rough_var=0)
M["glass"] = M["paneW2"]       # cabin glass reads like the building windows
M["tyre"] = M["roof"]

from bpy_extras.object_utils import world_to_camera_view


def screen(p):
    v = world_to_camera_view(scene, scene.camera, Vector((p.x, p.y, 0)))
    return v.x * 1920, (1 - v.y) * 1080


def off_by(p):
    """how far (px, 1920 frame) a ground point is outside the frame; negative = inside"""
    x, y = screen(p)
    return max(-x, x - 1920, -y, y - 1080)


# ------------------------------------------------------------------ lane geometry
def lane_line(pts, ends):
    """centreline (world) → lane line on the driving side, ends extended off-frame, corners filleted"""
    P = [Vector((p.x, p.y)) for p in pts]
    # offset each segment to the lane, then intersect neighbours (all streets are axis-aligned)
    segs = []
    for a, b in zip(P, P[1:]):
        d = (b - a).normalized()
        left = Vector((-d.y, d.x))
        o = left * LANE * (1 if KEEP_LEFT else -1)
        segs.append((a + o, b + o, d))
    L = [segs[0][0]]
    for (a0, b0, d0), (a1, b1, d1) in zip(segs, segs[1:]):
        cr = d0.x * d1.y - d0.y * d1.x
        if abs(cr) < 1e-6: L.append(b0); continue
        t = ((a1 - a0).x * d1.y - (a1 - a0).y * d1.x) / cr
        L.append(a0 + d0 * t)
    L.append(segs[-1][1])
    # extend off-frame ends until the wrap point is OFF_MARGIN px clear of the frame
    for idx, kind in ((0, ends[0]), (-1, ends[1])):
        if kind != "off": continue
        nb = L[1] if idx == 0 else L[-2]
        d = (L[idx] - nb).normalized()
        while off_by(L[idx]) < OFF_MARGIN: L[idx] = L[idx] + d * 1.0
    return L


def fillet(L):
    """dense polyline with quadratic-Bezier corners of radius ~TURN_R"""
    out = [L[0]]
    for i in range(1, len(L) - 1):
        a, c, b = L[i - 1], L[i], L[i + 1]
        r = min(TURN_R, (c - a).length / 2, (b - c).length / 2)
        p0, p2 = c + (a - c).normalized() * r, c + (b - c).normalized() * r
        out.append(p0)
        for k in range(1, 12):
            t = k / 12
            out.append(p0 * (1 - t) ** 2 + c * 2 * (1 - t) * t + p2 * t * t)
        out.append(p2)
    out.append(L[-1])
    return out


class Path:
    def __init__(self, pts):
        self.p = pts
        self.s = [0.0]
        for a, b in zip(pts, pts[1:]): self.s.append(self.s[-1] + (b - a).length)
        self.length = self.s[-1]

    def extend_start(self, by):
        """lengthen the (off-frame) start straight back by `by` metres"""
        d = (self.p[0] - self.p[1]).normalized()
        self.__init__([self.p[0] + d * by] + self.p)

    def extend_end(self, by):
        d = (self.p[-1] - self.p[-2]).normalized()
        self.__init__(self.p + [self.p[-1] + d * by])

    def at(self, s):
        s = s % self.length
        lo, hi = 0, len(self.s) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.s[mid] <= s: lo = mid
            else: hi = mid
        a, b = self.p[lo], self.p[lo + 1]
        t = (s - self.s[lo]) / max(1e-9, self.s[lo + 1] - self.s[lo])
        d = (b - a).normalized()
        return a.lerp(b, t), math.atan2(d.y, d.x)


lanes = []          # (name, Path, ends)
for name, px_pts, ends in ROUTES:
    world = [ground_at(*p) for p in px_pts]
    for rev in (False, True):
        pts, e = (list(reversed(world)), ends[::-1]) if rev else (world, ends)
        path = Path(fillet(lane_line(pts, e)))
        # make the route a whole number of PERIODs by lengthening an off-frame end
        extra = math.ceil(path.length / PERIOD - 1e-9) * PERIOD - path.length
        if e[0] == "off": path.extend_start(extra)
        else:             path.extend_end(extra)
        lanes.append((f"{name}{'-rev' if rev else ''}", path, e, DENSITY[name]))


# ------------------------------------------------------------------ traffic (deterministic, collision-free)
rng = random.Random(SEED)
cars = []           # (lane name, Path, s0, colour)


def positions(lane_cars, f):
    t = f / N * SECONDS
    return [path.at(s0 + SPEED * t)[0] for (_, path, s0, _) in lane_cars]


def discs(lane_cars, f):
    """each car as three discs along its body (front, middle, back)"""
    t = f / N * SECONDS; out = []
    for (_, path, s0, _) in lane_cars:
        p, h = path.at(s0 + SPEED * t); d = Vector((math.cos(h), math.sin(h)))
        out.append([p + d * DISC[0], p, p - d * DISC[0]])
    return out


def visible_any(path, s0):
    return any(off_by(path.at(s0 + SPEED * f / N * SECONDS)[0]) < 0 for f in range(0, N, 6))


def clashes(new, placed):
    for f in range(0, N, 2):
        a = discs(new, f); b = discs(placed, f)
        for i, ca in enumerate(a):
            for cb in a[i + 1:] + b:
                if (ca[1] - cb[1]).length > 12: continue
                if any((x - y).length < 2 * DISC[1] for x in ca for y in cb): return True
    return False


for (lname, path, ends, (lo, hi)) in lanes:
    n_win = round(path.length / PERIOD)
    for attempt in range(400):
        m = rng.randint(lo, hi)
        offs = sorted(rng.uniform(0, PERIOD) for _ in range(m))
        cols = [rng.choice(COLOURS) for _ in range(m)]
        new = [(lname, path, w * PERIOD + o, c) for w in range(n_win) for (o, c) in zip(offs, cols)]
        new = [c for c in new if visible_any(c[1], c[2])]       # never-seen cars cost nothing; drop them
        if not clashes(new, cars):
            cars += new; break
    else:
        print("WARN no clear slot for lane", lname)

# hidden wrap points must be hidden for a whole car (±2.5 m) on its lane, seen from the camera
dg = bpy.context.evaluated_depsgraph_get()
for (lname, path, ends, _) in lanes:
    for idx, kind in ((0, ends[0]), (-1, ends[1])):
        if kind != "hid": continue
        s_end = 0.0 if idx == 0 else path.length
        for ds in (-2.5, 0.0, 2.5):
            p, _ = path.at(min(path.length - 1e-6, max(0.0, s_end + ds)))
            for z in (0.3, 1.5):
                hit = scene.ray_cast(dg, Vector((p.x, p.y, z)) + TO_CAM * 0.5, TO_CAM)
                print(f"  wrap {lname} {'start' if idx == 0 else 'end'} ds={ds:+.1f} z={z}: "
                      f"{'hidden by ' + hit[4].name if hit[0] else 'VISIBLE'}")

print(f"loop {N} frames @ {FPS} fps, {SPEED} m/s, period {PERIOD} m, {len(cars)} cars")
for (lname, path, ends, _) in lanes:
    print(f"  {lname:14s} {path.length:6.1f} m = {path.length / PERIOD:.2f} periods, ends {ends}, "
          f"cars {sum(1 for c in cars if c[0] == lname)}")


# ------------------------------------------------------------------ the car model (a clay miniature)
def car_template(colour):
    """body + cabin + tyres, origin at ground centre, facing +X. One collection per colour, instanced."""
    col = bpy.data.collections.new("CarTemplate_" + colour)     # not linked to the scene: only instanced
    body = rounded_box("Body", 4.2, 1.85, 0.78, 0.30, [M[colour]], c=col, loc=(0, 0, 0.32), segments=4)
    cabin = rounded_box("Cabin", 2.2, 1.6, 0.62, 0.26, [M["glass"]], c=col, loc=(-0.25, 0, 1.06), segments=4)
    roof = rounded_box("Roof", 1.9, 1.5, 0.10, 0.05, [M[colour]], c=col, loc=(-0.25, 0, 1.66), segments=2)
    for (x, y) in ((1.35, 0.78), (1.35, -0.78), (-1.35, 0.78), (-1.35, -0.78)):
        B["cylinder"](0.36, 0.34, (x, y, 0.36), M["tyre"], col, verts=16).rotation_euler.x = math.pi / 2
    for ob in col.objects:      # scale about the car's ground centre
        ob.location = ob.location * CAR_SCALE; ob.scale = ob.scale * CAR_SCALE
    return col


templates = {c: car_template(c) for c in set(c[3] for c in cars)}
traffic = bpy.data.collections.new("Traffic"); scene.collection.children.link(traffic)
objs = []
for i, (lname, path, s0, colour) in enumerate(cars):
    e = bpy.data.objects.new(f"Car_{i:02d}_{lname}", None)
    e.instance_type = 'COLLECTION'; e.instance_collection = templates[colour]
    traffic.objects.link(e); objs.append((e, path, s0))

scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, N - 1
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'CONSTANT'   # every frame is keyed; no tweening across a wrap
for f in range(N):
    t = f / N * SECONDS
    for (e, path, s0) in objs:
        p, h = path.at(s0 + SPEED * t)
        e.location = (p.x, p.y, 0.0); e.rotation_euler = (0, 0, h)
        e.keyframe_insert("location", frame=f); e.keyframe_insert("rotation_euler", frame=f)

# ------------------------------------------------------------------ render setup
scene.render.resolution_x, scene.render.resolution_y = WIDTH, WIDTH * 9 // 16
scene.render.resolution_percentage = 100
scene.render.use_motion_blur = False          # ~3 px per frame; blur across a wrap would streak
scene.render.use_persistent_data = True       # keep the static city's BVH between frames
scene.cycles.use_animated_seed = False        # frozen noise: static pixels identical every frame
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "tamira-city-traffic.blend"))


def render_frames(a, b):
    d = os.path.join(OUT, "frames"); os.makedirs(d, exist_ok=True)
    s = scene.render.image_settings
    s.file_format = 'PNG'; s.color_mode = 'RGB'; s.color_depth = '8'; s.compression = 15
    for f in range(a, b + 1):
        fp = os.path.join(d, f"f_{f:04d}.png")
        if os.path.exists(fp): continue
        open(fp + ".lock", "w").close()
        scene.frame_set(f)
        scene.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        os.remove(fp + ".lock")
        print("frame", f, "done", flush=True)


def encode():
    import glob
    files = sorted(glob.glob(os.path.join(OUT, "frames", "f_*.png")))
    assert len(files) == N, f"need {N} frames, have {len(files)}"
    sq = scene.sequence_editor_create()
    strip = sq.strips.new_image("loop", files[0], 1, 1) if hasattr(sq, "strips") else sq.sequences.new_image("loop", files[0], 1, 1)
    for fp in files[1:]: strip.elements.append(os.path.basename(fp))
    strip.colorspace_settings.name = "sRGB"
    scene.frame_start, scene.frame_end = 1, N
    vs = scene.view_settings; vs.view_transform = 'Standard'; vs.look = 'None'; vs.exposure = 0
    r = scene.render
    if hasattr(r.image_settings, "media_type"): r.image_settings.media_type = 'VIDEO'   # Blender 5: video is a media type
    r.image_settings.file_format = 'FFMPEG'
    ff = r.ffmpeg
    for codec, container, name in (("H264", "MPEG4", "mp4"), ("AV1", "WEBM", "webm")):
        try:
            ff.format = container; ff.codec = codec
        except TypeError as e:
            print("skip", codec, e); continue
        ff.constant_rate_factor = 'HIGH'; ff.ffmpeg_preset = 'BEST'; ff.gopsize = FPS
        ff.audio_codec = 'NONE'
        r.filepath = os.path.join(OUT, f"hero-traffic-{WIDTH}.{name}")
        bpy.ops.render.render(animation=True)
        print("encoded", r.filepath, flush=True)


if JOB.startswith("frames"):
    a, b = (map(int, JOB.split(":")[1].split("-")) if ":" in JOB else (0, N - 1))
    render_frames(a, b)
elif JOB == "poster":
    scene.frame_set(0)
    s = scene.render.image_settings
    s.file_format = 'PNG'; s.color_mode = 'RGB'; s.color_depth = '16'
    scene.render.filepath = os.path.join(OUT, "hero-city.png")
    bpy.ops.render.render(write_still=True)
    s.file_format = 'JPEG'; s.color_depth = '8'; s.quality = 92
    bpy.data.images["Render Result"].save_render(os.path.join(OUT, "hero-city.jpg"), scene=scene)
elif JOB == "encode":
    encode()
print("DONE", JOB, OUT, flush=True)
