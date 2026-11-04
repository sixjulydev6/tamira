"""Poster continuity check: does a new hero render sit on the old one (and so on the wireframe)?

    blender -b --factory-startup --python check_alignment.py -- <old.jpg> <new.png> <out_dir>

Both images are compared at 1920x1080. Writes overlay-50.png (50% mix) and edges.png (old edges in
red, new edges in cyan; white where they coincide), and prints the best integer shift between the
two edge maps (searched over ±8 px) and how much of the edge energy agrees at zero shift.
A shift of (0, 0) means no visible jump at the image → wireframe hand-over.
"""
import bpy, sys, os
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
OLD, NEW, OUT = argv[:3]
os.makedirs(OUT, exist_ok=True)
W, H = 1920, 1080


def load(path):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = "Non-Color"     # compare stored pixel values as they are
    if tuple(img.size) != (W, H):
        img.scale(W, H)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)[..., :3]
    return a[::-1]                                   # rows top-down


def edges(rgb):
    l = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    gx = np.zeros_like(l); gy = np.zeros_like(l)
    gx[:, 1:-1] = l[:, 2:] - l[:, :-2]; gy[1:-1] = l[2:] - l[:-2]
    e = np.hypot(gx, gy)
    return np.clip(e / (np.percentile(e, 99) + 1e-6), 0, 1)


def save(arr, name):
    img = bpy.data.images.new(name, W, H, alpha=True)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.concatenate([arr, np.ones((H, W, 1), np.float32)], axis=2)[::-1]
    img.pixels[:] = rgba.ravel()
    img.filepath_raw = os.path.join(OUT, name); img.file_format = "PNG"; img.save()


a, b = load(OLD), load(NEW)
ea, eb = edges(a), edges(b)
m = 12   # ignore the frame border
best, score0 = None, None
for dy in range(-8, 9):
    for dx in range(-8, 9):
        sb = np.roll(np.roll(eb, dy, 0), dx, 1)
        s = float((ea[m:-m, m:-m] * sb[m:-m, m:-m]).sum())
        if dx == 0 and dy == 0: score0 = s
        if best is None or s > best[0]: best = (s, dx, dy)
norm = float(np.sqrt((ea[m:-m, m:-m] ** 2).sum() * (eb[m:-m, m:-m] ** 2).sum()))
print(f"best shift dx={best[1]} dy={best[2]}  edge agreement at 0,0: {score0 / norm:.3f}  at best: {best[0] / norm:.3f}")
save(0.5 * a + 0.5 * b, "overlay-50.png")
save(np.stack([ea, eb, eb], axis=2) * 0.9 + 0.05, "edges.png")
