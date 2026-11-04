> **Runtime update:** Blender renders here are now reference/fallback assets. The shipped interactive city, moving cars and camera rise are generated in `src/story/daylight.js`; no offline animation render is required for normal browsing. See `docs/LIVE-3D.md`. Existing source art has been preserved.

# Hero art pipeline

The day city hero (`public/media/hero-city-*`) is a Cycles render from one script. It replaces the
earlier `hero-day.jpg`, keeping its layout and camera but with a different finish: satin
ceramic instead of soft and foggy (brief: `prompt.md`).

```
art/
  blender/build_city.py        builds the scene and renders it (Blender 5.2, any OS)
  blender/encode_web.py        resized PNGs → WebP + JPG (3840, 2560, 1920 wide)
  blender/check_alignment.py   old vs new render: edge overlay and best pixel shift
  tools/check-layout.mjs       city.js (wireframe) vs city-layout.json (render): same buildings?
  data/city-layout.json        camera, buildings, crown, roads, trees, projected anchors (from the render)
  renders/                     display master (3840×2160 PNG) and the three review crops
  review/                      baseline vs after screenshots, alignment overlay, before/after sheet
```

## Render

Renders run on the shared team machine as a background process. Never touch the Blender file
open in the live session:

```
blender.exe -b --python C:\Users\india\Documents\tamira-reference-match\blender\build_city.py ^
  -- C:\Users\india\Documents\tamira-reference-match\renders\clay\final 384 100
```

- Output is 3840×2160 (4K, so Retina screens never upscale it). RTX 3060 / OptiX: a few minutes at 384 samples.
- Optional 4th argument: look-dev overrides, for example `"world=0.34,sun_angle=5,dof=0.4"`. The knobs are listed in `LOOK` at the top of the script.
- Outputs: `hero-city.exr` (linear master, half float), `hero-city.png` (AgX, 16-bit), `hero-city.jpg`, three `crop-*.png` review crops, `city-layout.json` and `tamira-city.blend`.
- The script is deterministic (seeded). The same arguments give the same image.

## Encode for the web

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender; M=art/renders/hero-city-3840.png; T=$(mktemp -d)
cp $M $T/3840.png; sips -z 1440 2560 $M --out $T/2560.png; sips -z 1080 1920 $M --out $T/1920.png
$B -b --factory-startup --python art/blender/encode_web.py -- public/media hero-city $T/3840.png $T/2560.png $T/1920.png
for w in 3840 2560 1920; do sips -s format avif -s formatOptions 85 $T/$w.png --out public/media/hero-city-$w.avif; done
```

Current weights (3840 / 2560 / 1920): AVIF 246 / 162 / 125 KB, WebP 239 / 147 / 109 KB, JPG 539 / 311 / 210 KB. Retina laptops and phones get the 3840 file (they need 2900–3700 px).

## Checks before shipping a new render

1. `node art/tools/check-layout.mjs`: the wireframe and the render must share one layout. If you change `BUILDINGS`, change it in `build_city.py` and `src/story/city.js` together.
2. Run `blender -b --factory-startup --python art/blender/check_alignment.py -- <previous.jpg> <new.png> <out>`. It must report `best shift dx=0 dy=0`.
3. Check `?at=wireOn:0.33` in the browser: the cyan lines should sit on the render's edges while it crossfades.
4. Look at the three crops at 100% (crown notch, white roof/windows, ground contact), then at the whole hero in the page at 1440, 768 and 390 px.

Every web size keeps the 16:9 frame. `scene.js` fits the 3D camera to that frame
(`VIDEO_W/H`), so a different aspect or crop would break the hand-over.

## Moving files between the machines

The renders live on the Windows machine. A local file server on the Mac was refused by this
session's permission policy, so files were moved through the Blender MCP instead:
- Text (scripts, JSON): written or printed as text, then checked with sha256 on both ends.
- Images: viewed with the MCP `look` tool, which keeps a lossless PNG copy on the Mac. `look` caps at 2000 px, so the 2560 master came over as two 1280×1440 tiles that were stitched back together. They were stitched with Blender's Python, so the pixels are exact.

The EXR and 16-bit PNG masters stayed on the team machine under `renders\clay\final\`.

## Traffic loop (the hero video)

`blender/animate_city.py` builds the same city (`build_city.py` with mode `anim`: no parked cars,
same layout, look and camera) and adds clay cars driving the streets in a seamless 10 s loop.

```
blender.exe -b --python animate_city.py -- <out> 128 2560 check     # routes, wrap points, collisions; saves the .blend
blender.exe -b --python animate_city.py -- <out> 128 2560 frames    # 240 PNGs in <out>\frames (resumable)
blender.exe -b --python animate_city.py -- <out>\poster 384 3840 poster   # frame 0 as the new hero-city still
blender.exe -b --python animate_city.py -- <out> 128 2560 encode    # hero-traffic-2560.mp4 (H.264) + .webm (AV1)
```

- Knobs at the top of the script: `SECONDS`, `FPS`, `SPEED`, `ROUTES`, `DENSITY`, `COLOURS`, `CAR_SCALE`.
- Seamless by construction: one speed for every car, and each lane's pattern repeats every
  `SPEED × SECONDS` metres; cars wrap only off-frame or behind a building (the check prints the ray casts).
- The seed is fixed, so the static city is the same in every frame; only the cars' pixels change.
- On the team machine the whole chain runs from `renders\traffic\run_traffic.cmd` as one detached,
  below-normal-priority process. The poster then goes through the encode steps above as `hero-city-*`.

## The hero's rise (street level → isometric)

Same script, same scene as the traffic loop (cars frozen at loop frame 0), sky transparent:

```
blender.exe -b --python animate_city.py -- <out> 96 1600 rise          # 72 RGBA frames → <out>\rise (resumable)
blender.exe -b --python animate_city.py -- <out> 384 3840 riseposter   # frame 0 at 3840: the opening still
blender.exe -b --python animate_city.py -- <out> 16 1600 risewebp      # → rise_webp\, riseposter_webp\ (WebP, alpha, q80)
```

- Camera knobs: `RISE` (azimuth, camera height, distance, lens, look-at height, lens shift) and `RISE_N`.
  The last frame is the build_city ortho camera itself, so it lands exactly on `hero-city-*`.
- The ground fades to transparent beyond the isometric frame's furthest corner (+40 m), so the
  street-level horizon is white sky; nothing inside the isometric frame changes.
- Site files: `rise_webp\r_*.webp` → `public/media/rise/`; `riseposter_webp\r_0000.webp` → `public/media/hero-rise-3840.webp`
  (and a 1920 copy, `hero-rise-1920.webp`).
