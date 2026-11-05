> **2026-11-05 skyline update:** the old clay-city/avenue opener described below is replaced by the supplied GLB city, architectural scan, underground network, tower room and ceiling-wire sequence. The existing single-core product story and final room remain. See [SKYLINE-HERO.md](SKYLINE-HERO.md) for current implementation and segment meanings.

# Live city and interactions

The normal homepage now renders its city and camera rise in Three.js. It does not download or scrub the 72 rendered rise frames or request traffic videos. The transparent opening still remains for first paint, reduced motion and unavailable WebGL.

## Asset and interaction ownership

| System | Source |
| --- | --- |
| Solid city, crown, windows, roads, trees, cars, lights | `src/story/daylight.js` |
| Shared layout and dimensions, Z-up metres | `art/data/city-layout.json` |
| Camera rise and phone crop | `placeCamera()` in `daylight.js` |
| Daylight → wireframe composite; cable/product rendering | `src/story/scene.js` |
| Labeled scroll timeline, entrance, traffic ticker, responsive lifecycle | `src/main.js` |
| Story segment pacing | `src/story/timeline.js` |
| Existing wire and product props | `src/story/wire.js`, `src/story/props.js` |

37 building meshes including the crown, 1,721 window insets batched in three instanced meshes, and 54 cars are generated at initialization. All crown faces retain the recognizable V notches and central opening. Cars have separate clay bodies and charcoal cabins. The windows face the original asset's −Y/+X facades; the crown has window columns around all six arms.

The city shares the existing city canvas/renderer rather than adding another WebGL context. Daylight uses ACES tone mapping, dielectric MeshStandardMaterial surfaces, a low sky fill, a PMREM environment and a directional shadow map. Shadows are generated once because buildings and lights are static; moving cars do not cast dynamic shadows. Desktop shadow maps are 4096², phone maps 2048². Pixel ratio retains the existing 1.75 cap. The renderer crossfades daylight surfaces over the wireframe during `wireOn`, then uses the existing city/product handover.

Traffic is the one ambient animation: GSAP's ticker advances it only while daylight is visible and the document is not hidden. Story cameras, power, cable deformation, heat, flame and switch activation are functions of the labeled master timeline's progress, so they seek and reverse without depending on earlier scroll events.

`gsap.matchMedia()` owns normal/reduced-motion setup. A mode change stops the ticker, disposes renderers, geometry, materials, environment targets and compositor passes, and removes listeners before rebuilding. Context loss stops the scroll story and reveals static content. No automatic context-restoration loop is attempted; reload to retry after a lost context.

## Three-wire finale extension

The same product scene and `Wire` continue into the original red terminal, and two more `Wire` instances (black, green) seat in N and E (DECISIONS 29); no extra WebGL renderer or replacement cable scene. The camera uses the source three-wire choreography, with a short smoke bridge and no added tip-follow movement. The original room uses Canvas2D source images, not live Three.js furniture. See [ROOM-FINALE.md](ROOM-FINALE.md).

## Verification

Use **Comet** for browser access and visual review. Run `npm run build`. Historical browser integration scripts remain available; provide an installed Chrome executable via `CHROME_PATH` and, optionally, a path to the taste-skill CDP helper via `TASTE_CDP_MODULE`, then run `node scripts/verify-live-city.mjs` with Vite on port 5180.

The script checks desktop and phone initialization, absence of image-sequence/video requests, horizontal overflow, scene seeking and reversing, live reduced-motion switching, and context-loss fallback. It captures the rise, transition, powered city, cable, copper, strands, heat, flame and finale. Reports and screenshots go to `.taste-skill/live-city/`.

Initial browser checks: no captured JavaScript exceptions at 1440×900 and 390×844; 42 / 36 draw calls and approximately 37k / 34k triangles in the opening view respectively. These counters are opening-view measurements, not whole-story maxima or device frame-rate results. The existing extended wireframe and product scenes have different costs.

Remaining limits: no real-device GPU profiling, no path-traced indirect bounce, simplified car motion without intersection collision simulation, and the existing city-wire overlay occlusion workaround. Product specifications and contact destinations remain placeholders listed in `OPEN-ITEMS.md`. Old media still exists in `public/` and is copied by Vite; it is not fetched by the live story, but a separate asset cleanup is needed before deployment.

Technical references: [Three.js PBR materials](https://threejs.org/docs/pages/MeshStandardMaterial.html), [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia/), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/). Implementation uses the repository's pinned Three.js r170 and GSAP 3.12.5 APIs, not newer renderer-only features.

The latest board visibility fix and expanded `boardVisible` assertion have not received a completed Comet/post-fix regression run. Earlier browser passes described above predate that fix and missed the hidden board. Latest state and pushed implementation commit: [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md).
