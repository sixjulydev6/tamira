"""Turn the room renders (opaque PNGs from build_room.py) into the site's room WebPs.

  Blender -b --factory-startup --python finish_room.py -- <map.json> <out_dir>

map.json: {"d-l0-5": "/path/to/png", ...}. Level 0 stays opaque. Levels 1-3 get the soft edges the
painter blends with (src/story/original/roompaint.js, EDGE = 0.07): alpha = smoothstep(0, 0.07, d) on
every side that doesn't touch the frame's border, d measured as a share of that level's own width or
height. That's the profile measured from the original assets (0.055 at 1%, 0.5 at 3.5%, 1 at 7%).
"""
import bpy, json, os, sys
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
MAP, OUT = json.load(open(argv[0])), argv[1]
ROOM = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'story', 'room.json')))
EDGE = 0.07

sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
st = sc.render.image_settings; st.file_format = 'WEBP'; st.quality = 90

def smooth(x):
    t = np.clip(x / EDGE, 0, 1); return t * t * (3 - 2 * t)

for name, src in sorted(MAP.items()):
    f, lv, _ = name.split('-'); level = ROOM[f]['levels'][int(lv[1:])]
    x0, y0, x1, y1 = level['region']; W, H = level['px']
    im = bpy.data.images.load(src); w, h = im.size
    assert (w, h) == (W, H), f'{name}: {w}x{h}, expected {W}x{H}'
    px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(h, w, 4)   # rows bottom-up
    a = np.ones((h, w), np.float32)
    if lv != 'l0':
        u = (np.arange(w) + 0.5) / w; v = (np.arange(h) + 0.5) / h        # v from the top
        ax = np.ones(w, np.float32); ay = np.ones(h, np.float32)
        if x0 > 0.001: ax *= smooth(u)
        if x1 < 0.999: ax *= smooth(1 - u)
        if y0 > 0.001: ay *= smooth(v)
        if y1 < 0.999: ay *= smooth(1 - v)
        a = (ay[:, None] * ax[None, :])[::-1]                              # to bottom-up rows
    px[..., 3] = a
    out = bpy.data.images.new(name, w, h, alpha=True); out.pixels.foreach_set(px.ravel())
    st.color_mode = 'RGB' if lv == 'l0' else 'RGBA'
    path = os.path.join(OUT, name + '.webp'); out.save_render(path, scene=sc)
    print('[finish]', name, w, h, os.path.getsize(path), flush=True)
