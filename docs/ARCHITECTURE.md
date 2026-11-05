> **2026-11-05 skyline update:** the old clay-city/avenue opener described below is replaced by the supplied GLB city, architectural scan, underground network, tower room and ceiling-wire sequence. The existing single-core product story and final room remain. See [SKYLINE-HERO.md](SKYLINE-HERO.md) for current implementation and segment meanings.

# Architecture

## Files

```
index.html                 header + nav, the story stage, the end section
src/style.css              all styles; design tokens at the top in :root
src/main.js                menu, page-load reveal, the master scroll timeline, page colour,
                           hero image/canvas fades, chapter copy, labels, gauge, static fallback
src/story/
  timeline.js              SEGMENTS, TOTAL_SCREENS, local(p, id), progressOf(), smooth/lerp/windowed helpers
  palette.js               COLORS and pageColors(p) → { bg, ink, dark }
  chapters.js              chapter copy, pinned label text, gauge values
  scene.js                 createStory(): renderers, city camera, city wire, product wire, per-chapter
                           choreography, label anchors, the hand-over mapping
  daylight.js              live PBR city, camera rise, traffic and shadow lifecycle
  finale-stage.js          shared product cable/scene adapter, original camera, rear board, room frustum
  finale-timing.js         source-unit clock shared by finale and room
  room.js / room.json      room painter lifecycle and original camera/board metadata
  original/                adapted source finale, surface, camera table and room helpers
  city.js                  the wireframe city: port of hero_day.py, extended city, avenue, street lights,
                           all city shaders (lines, hulls, lamps, building lights)
  wire.js                  Wire class: procedural single-core wire (jacket + 30 strands) bent onto a path
  props.js                 conduit, heater, flame, smoke puffs, wall switch plate (procedural)
public/media/hero-city-*   retained offline art/reference renders, not the normal live city
public/media/hero-traffic-2560.{webm,mp4}   retained offline traffic references; not requested by the live story
public/room/               original 48 room WebPs (Canvas2D ending)
art/                       the hero's Blender source, layout manifest and checks (art/README.md)
```

## The stage

There is one `<section class="story">`, `(TOTAL_SCREENS + 1) × 100svh` tall. Inside it, `.story__stage` is `position: sticky`, 100svh tall. Its layers, bottom to top:

1. `.hero__stage`: first-paint/static fallback imagery; old rendered rise/video playback is inactive.
2. `canvas.story__canvas`: shared daylight/rise/wireframe city renderer and city-wire overlay.
3. `canvas.story__canvas--wire`: product chapters plus the same-scene three-wire switchboard finale (red is the product wire).
4. Hero typography/aside layered around the crown city as the current hero composition requires.
5. `.room-finale`: Canvas2D original room painter, shown after a decoded frame exists and after matched board-camera alignment.
6. Chapter copy, pinned strand labels and heat gauge above the visuals.

## Control flow

```
GSAP ScrollTrigger (scrub 0.6) on .story ──► state.p (0–1)
        │
        ▼
main.js render(p)
  ├─ pageColors(p) ─► --bg / --ink CSS vars, theme-color
  ├─ hero image / city canvas / product canvas opacity
  ├─ hero headline fade, chapter copy windows
  ├─ story.update(p, { bg }) ─► returns label anchors (screen px)
  ├─ labels positioned at the anchors
  └─ gauge value
```

- **Story state is derived from progress.** Camera, geometry and chapter state seek/reverse deterministically. A GSAP ticker advances daylight traffic while visible and allows room repaints after asynchronous image decode. Resource loading and rendering have lifecycle state; do not describe the entire renderer as a pure function.
- **Segment-local progress.** `local(p, "run")` gives 0–1 progress inside a segment. `smooth(a, b, x)` and `windowed(x, a, b, c, d)` shape the in/out timing.
- **Lazy loading.** `scene.js` is imported with `import()` after first paint (`requestIdleCallback`). Until it loads, `render` still runs and skips the 3D.
- **Fallback.** If `createStory` throws (no WebGL), or the user prefers reduced motion, `goStatic()` switches to the static layout.

## Live city and ending ownership

`daylight.js` generates the PBR city and rise from the shared layout manifest; it shares the city renderer, uses ACES tone mapping for daylight, then hands off to the existing wireframe compositor. See [LIVE-3D.md](LIVE-3D.md). `gsap.matchMedia()` owns normal/static lifecycle and disposal.

`finale-stage.js` adds the original board group to the existing product scene and reuses the same `Wire`. No third renderer or replacement wire scene exists. `scene.js` reconstructs the smoke endpoint for each seek/resize; the adapter morphs its world path and scale to the original red rail. Only the smoke bridge (6.06–6.32) adapts the camera; the source spline, lens/view offset and red insertion timing are retained afterward. No added tip-follow translation and no smoke-to-board canvas fade.

**Visibility invariant:** `finaleStage.hide()` is called before reconstructing the smoke endpoint. The original board updater must set `group.visible = fade > 0.005` every call, outside the cached material-opacity block. Otherwise constant fade 1 leaves the board hidden after the first frame. Diagnostics expose `boardVisible` and `connectionWires`; camera alignment alone cannot detect missing geometry.

`room.js`/`original/roompaint.js` use Canvas2D and source `room.json` framing. Source times, loading, exact asset provenance and room frustum matching are documented in [ROOM-FINALE.md](ROOM-FINALE.md). Only stage-owned board resources are disposed by the adapter; do not traverse/dispose the entire shared product scene there.

## Rendering

Two WebGL renderers on two canvases. The city one uses bloom; the product one doesn't, so the light page background matches exactly.

### City renderer (`renderer`, on `.story__canvas`)

**Pipeline:** `EffectComposer` running RenderPass → UnrealBloomPass (threshold 0.05) → OutputPass, with no tone mapping.
- Bloom strength is 0 while the page is light. It ramps up as the page turns dark and goes back down during the drain.
- **Then the city wire:** after the composer, `clearDepth()` runs and `cityWireScene` is rendered on top with Neutral tone mapping. This keeps the wire crisp (no bloom on it). The consequence: **nothing in the city can occlude the city wire**. That's why the avenue and the approach path are kept clear of buildings.

**What's in `cityScene`** (all custom `ShaderMaterial`s, all unlit):

| Object | Notes |
|---|---|
| `LineSegments` | The 1 px lines: interior grids (floor rings, window columns, crown grid, kept faint), ground grid, roads, poles. Per-vertex attributes: `bright` (line family brightness) and `ext` (1 = extended city). |
| Edge strips (`Mesh`) | Building outlines (`contour`, `crown`, `extContour`; widths in `THICK`, CSS px). Each segment is a quad expanded sideways in screen space by `EDGE_VERT` (attributes `aOther`, `aEnd`, `aSide`, `aWidth`; uniform `uDpr`), drawn double-sided with the same fragment shader as the lines, plus a soft edge. WebGL can't draw lines wider than 1 px, hence the quads. |
| Building hulls | Original-city boxes, crown extrusions, and the extended city as one `InstancedMesh`. They hide lines behind buildings and carry the lit windows. |
| Ground | A 6 km plane. |
| Street lights | Two instanced meshes: camera-facing glow billboards and flat light pools on the street. |
| Backdrop | A full-screen quad in the page colour, drawn first. |

**Why the backdrop exists:** the renderer's clear colour does not come out of the post-processing chain as the same sRGB colour as the shaders' `uBg`. The sky then showed lighter than the ground. The backdrop guarantees sky = hulls = ground = page colour.

**Shared uniforms** (the `shared` object in `scene.js`):

| Uniform | Meaning |
|---|---|
| `uBg` | Page colour, linear (THREE.Color from the hex, which is already linear working space; **do not** convert again) |
| `uReveal`, `uExtend` | Lines climbing by height for the original and the extended city |
| `uStage`, `uMaskMix`, `uMaskMode` | The same fade the CSS mask gives the day image, in screen space, so the hand-over is exact; relaxed to full-bleed as the camera pulls back |
| `uDrain`, `uDrainNdc`, `uFade` | The drain: a shrinking radius around the wire tip's projected screen position |
| `uHead` | The wire tip's world Y (street lights switch on when it passes) |
| `uPower` | Where building power has reached: equals the tip's Y during the run, then grows during the approach |

### Product renderer (`wireRenderer`, on `.story__canvas--wire`)

- Neutral tone mapping, rendered straight to the canvas, clearing to the page colour.
- `wireScene` contains:
  - RoomEnvironment (PMREM) as reflections
  - a key light and a rim light
  - the product `Wire`
  - the props
- `wireCam`: a 28° vertical-FOV perspective camera. The layout is in "normalised screen space": `halfW` is 13.3 world units on landscape and 8.4 on portrait, with `halfH = halfW / aspect`. On portrait, path Y values are compressed and moved down so the wire stays below the copy.

## The wireframe city (`city.js`)

### The original city
A direct JS port of `tamira-reference-match/blender/hero_day.py`:
- **Coordinates:** world is Blender's, Z up, metres, crown base at the origin.
- **Ported 1:1:** the `BUILDINGS` table, `groundAt()` (`ground_at`), the six-arm crown, `ROAD_SEGS` and the `wf` linework rules (contours, floor rings, column grids on important buildings, ground grid, circuit branches).
- **Keep it in sync:** if the Blender layout changes, the wireframe no longer sits on the day render.

### The extended city
- **Generation:** 40 m grid cells over ±760 m, with deterministic random (`rng(4242)`). About 56% of the remaining cells get a block (689 in total).
- **Kept clear:**
  - the original city's footprint
  - the avenue (±38 m)
  - `approachPath`: the patch on the avenue's near side, x 228–488 m and y from tipY − 380 to tipY + 140, which the camera crosses during the push-in
- **Height limits:** blocks just in front of the avenue (camera side) are capped low.

### Avenue and street lights
- `AVENUE = { x: 228, half: 7, lampOffset: 10.5, lampStep: 36, lampZ: 7.2, from: -1100, to: 1100, tipY: 120 }`.
- **Why x = 228 m:** it's the widest building-free strip in front of the original city. On screen it's the lower-left → upper-right diagonal.

### Building lights (shader functions shared by lines and hulls)

| Function | What it does |
|---|---|
| `powerLit(w)` | `smoothstep(0, 18, uPower − (w.y + 0.35·|w.x − 228|))`. Powered once the front has passed a point; further from the avenue lights later. |
| `windowsOn(w, n, lit)` | A procedural 4.6 m window grid on vertical faces. Each window has a random threshold, so they switch on one by one. |
| `litFacade(w, n)` | Warm window light only (no wall glow). Added to the hull colour. |

Lit buildings change only their windows; their lines and walls don't change.

## The wire (`wire.js`)

- **Model:** a single-core house wire. Jacket radius 1; 30 copper strands (1 + 6 + 11 + 12) of radius 0.115 inside a 0.8 core.
- **Path:** a CatmullRom curve through a few control points, resampled by arc length. Parallel-transport frames start from a `facing` vector, so the printed legend faces the camera.
- **Geometry:** a straight tube bent onto the path **on the CPU** each time the scroll moves (`update()`). It's cheap enough (~46k vertices), and lets path shapes morph freely.
  - Jacket segments are packed toward the tip, where the camera gets close.
  - Strand twist is measured from the tip, so two wires on different paths look identical at the tip.

**Parameters** (`wire.params`):

| Parameter | Meaning |
|---|---|
| `head` | Tip position as a fraction of path length |
| `strip` | Stripped length |
| `fan` | How far the strands spread past the jacket |
| `glow` | Ember-orange glow on the strands |
| `cut`, `cutAt` | Cutaway window |
| `heat`, `heatAt` | Orange heat band |
| `char`, `charAt` | Burn mark |
| `tailLen` | How far back the jacket is drawn |

**Material:** `MeshPhysicalMaterial` with a canvas legend texture ("TAMIRA 1.5 SQ MM HR-FR-LSH 1100 V"), patched with `onBeforeCompile` for the cutaway (`discard`), the heat emissive and the char darkening. The copper is `MeshStandardMaterial`, metal, with an added emissive term for the glow.

## The hand-over from city wire to product wire

The city wire and the product wire are two instances of the same `Wire` model. At the hand-over, both renders must be the same picture.

**The mapping:** `toCity()` in `scene.js` defines a similarity transform **M** from product-world to city-world:

```
city.x = AVENUE.x + product.z × 2.2
city.y = HEAD_Y   + (product.x − tip.x) × 2.2
city.z = (product.y + halfH + 1) × 2.2
```

In words: product x → city +Y, along the avenue; product y → city +Z, up; product z → city +X, toward the hand-over camera; scale 2.2 (`CITY_SCALE`).

**What goes through M:**
- **The lifted path:** the city wire's path near the tip is `SHAPES.entry` mapped by M, with straight avenue points in front of it at street level. During the run the same points sit flat on the street; `lift` morphs between the two.
- **The camera:** the final city pose is the product camera mapped by M: target M(0,0,0), azimuth 0, elevation 0, distance `d0 × 2.2`, matching vertical FOV 28°.
- **Lights and reflections:** the `cityWireScene` light directions are the product ones mapped by M. Its environment is rotated with `scene.environmentRotation`.
- **The legend:** the city wire's legend faces +X (`FACING_X`), which is the product's +Z.

**Keep these consistent or the seam shows:** `SHAPES.entry`, `CITY_SCALE`, `AVENUE.tipY` (`HEAD_Y`), and both scenes' lights.

## Isometric alignment and historical render matching

At the start of `wireOn`, the city camera must reproduce the Blender orthographic camera:

| Setting | Blender camera | Our approximation |
|---|---|---|
| Projection | Orthographic | Perspective, 0.5° lens from ~46 km (a perspective lens that narrow is orthographic to well under a pixel) |
| Elevation / azimuth | 38° / −45° | same |
| Frame width | 400 m | same |

**Fitting it to the image on screen:**
- **Window onto the frame:** `setViewOffset` maps the camera onto where the image actually sits on screen. `resize()` reads the stage rect and the image's `object-fit: cover` / `object-position` to compute that frame.
- **Same mask:** the shaders apply the CSS mask's gradients in screen space (`stageMask()`).
- **Relaxing to full bleed:** as the camera pulls back (`extend`), the view window and mask blend to the full canvas.

**Camera poses** are `{ target, el, az, D, hfov, vb }`, interpolated with log-lerp on distance and FOV (a dolly-zoom), in `cityPose(p)`:
1. `handoff` (the Blender camera)
2. `wide` (pulled back over the avenue)
3. `hand` (M of the product camera)

## Colour management notes

- `renderer.outputColorSpace = SRGBColorSpace`.
- `new THREE.Color("#hex")` is already converted to linear working space. Pass it straight into shader uniforms. Converting again made the ground darker than the page.
- City shaders are `toneMapped: false`. The bloom composer runs with `NoToneMapping`. The city wire pass and the product renderer use `NeutralToneMapping`.

## How to…

**Add or reorder a chapter**
1. Add a segment to `SEGMENTS` (`timeline.js`).
2. Add copy to `CHAPTERS` (`chapters.js`). The `id` must match the segment id.
3. In `wireState()` (`scene.js`), drive the wire params, props and camera from `local(p, "<id>")`.
4. Optionally add a tint in `pageColors()` (`palette.js`).

**Swap a procedural prop for a Blender GLB**
Load it once with `GLTFLoader` (meshopt/Draco and KTX2 recommended), add it to `props.group`, and keep the same name on the returned object. `wireState()` only sets position, scale, visibility and opacity.

**Change the city layout**
Update `art/data/city-layout.json`, `daylight.js` and the corresponding `BUILDINGS` / `ROAD_SEGS` wireframe data in `city.js`. Preserve alignment with the offline Blender reference when editing the shared layout. Check `?at=wireOn:0.4` to confirm the lines still sit on the render.

**Move where the wire stops**
Change `AVENUE.tipY`. The hand-over frame, `approachPath` and the camera follow it. Then check `?at=approach:0.99` and `?at=drain:0.99`.

## Performance notes

- Story geometry updates follow scroll progress; the visibility-gated GSAP ticker also handles live traffic and room repaint after image decode.
- Pixel ratio is capped at 1.75.
- Per scroll tick: the city is about 44k line vertices, 36 original hull meshes plus 689 instanced extended hulls, and 124 street lights (glow + pool). The wire rebuilds about 46k vertices on the CPU: jacket 261 × 37, strands 30 × 151 × 8.
- **Not yet tested on real phones.** See [OPEN-ITEMS.md](OPEN-ITEMS.md).

Use **Comet** for browser review. Implementation build passes; post-fix rear-board visual verification remains incomplete. See [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md).
