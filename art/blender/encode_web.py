"""Encode display-referred hero PNGs into the WebP and JPG files the site serves.

    blender -b --factory-startup --python encode_web.py -- <out_dir> <name> <png> [<png> ...]

Each PNG is encoded at its own size as <name>-<width>.{webp,jpg}. Resize beforehand with a
proper resampler (`sips -z`, see art/README.md); Blender's own image.scale aliases when
downscaling. AVIF is made with `sips`. Blender is used here because it is the one encoder on both
render machines that writes WebP; pixels pass through untouched (Standard view, no look).
"""
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, NAME, SRCS = argv[0], argv[1], argv[2:]
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
s = scene.render.image_settings
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0

# high quality on purpose: the hero is large on Retina screens and smooth gradients band easily
for src in SRCS:
    img = bpy.data.images.load(src)
    img.colorspace_settings.name = "sRGB"
    width = img.size[0]
    for fmt, ext, q in (("WEBP", "webp", 88), ("JPEG", "jpg", 86)):
        s.file_format = fmt; s.color_mode = "RGB"; s.quality = q
        if fmt == "JPEG": s.color_depth = "8"
        path = os.path.join(OUT, f"{NAME}-{width}.{ext}")
        img.save_render(path, scene=scene)
        print("wrote", path, os.path.getsize(path))
    bpy.data.images.remove(img)
