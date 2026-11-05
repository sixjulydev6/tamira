"""Encode the baked HDR lightmaps (bake_room_lightmaps.py) for the web as RGBM WebP.

  Blender -b --factory-startup --python encode_lightmaps.py -- <out_dir> <lm-0.hdr> … <lm-5.hdr>

RGBM: alpha M = ceil(max(r,g,b) / range · 255) / 255, rgb = colour / (M · range), so dark gradients keep
their precision. range is the map's 99.95th-percentile channel value (rarer peaks clip). Decoded in the
shader as rgb · a · range (src/story/room-glb.js). Writes <out_dir>/lm-<g>.webp and lightmaps.json.
"""
import bpy, json, os, sys
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, FILES = argv[0], argv[1:]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGBA'; st.quality = 100

maps = []
for f in FILES:
    im = bpy.data.images.load(f); w, h = im.size
    px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    c = np.clip(px[..., :3], 0, None); mx = c.max(axis=2)
    rng = float(max(np.percentile(mx, 99.95), 1e-4))
    M = np.clip(np.ceil(np.minimum(mx / rng, 1) * 255) / 255, 1 / 255, 1)
    out = np.empty_like(px); out[..., :3] = np.clip(c / (M[..., None] * rng), 0, 1); out[..., 3] = M
    name = os.path.splitext(os.path.basename(f))[0] + '.webp'
    # byte buffer: a float-buffer image gets an sRGB curve baked in when saved to 8 bits, whatever its colour space
    o = bpy.data.images.new(name, w, h, alpha=True, float_buffer=False); o.colorspace_settings.name = 'Non-Color'
    o.alpha_mode = 'STRAIGHT'; o.pixels.foreach_set(out.ravel())
    path = os.path.join(OUT, name); o.save_render(path, scene=sc)
    # round-trip check: decode what was written and compare with the HDR
    back = bpy.data.images.load(path); back.colorspace_settings.name = 'Non-Color'; back.alpha_mode = 'STRAIGHT'
    b = np.empty(w * h * 4, np.float32); back.pixels.foreach_get(b); b = b.reshape(h, w, 4)
    dec = b[..., :3] * b[..., 3:4] * rng; ok = mx < rng
    err = float(np.abs(dec - c)[ok].mean() / max(c[ok].mean(), 1e-6))
    maps.append(dict(file=name, range=rng, size=[w, h]))
    print('[encode]', name, w, h, 'range %.4f' % rng, 'bytes', os.path.getsize(path), 'mean rel err %.4f' % err, flush=True)
json.dump(dict(encoding='RGBM', maps=maps), open(os.path.join(OUT, 'lightmaps.json'), 'w'), indent=1)
