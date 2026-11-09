# Tamira working brief

Read [docs/CURRENT-CONTEXT.md](docs/CURRENT-CONTEXT.md) first. Updated 2026-11-04; implementation commit `6d33386` is pushed to `origin/bishwa-wire-v1`. This documentation pass is local until explicitly committed/pushed.

## Latest direction (2026-11-05)

The current opener is the supplied GLB skyline → dusk → architectural scan → underground network → tower room → ceiling wire sequence, adapted to vanilla Three.js in `src/story/skyline/`. It now includes a `bundle` construction reveal with red/blue/green cores; the same red core physically pulls out during `drain` and leads into the unchanged single-core product story (DECISIONS 37). Preserve the existing fonts, header, frame and copy layout. Read `docs/SKYLINE-HERO.md`. The clay-city instructions below are historical and do not override this replacement.

## Room approach camera (2026-11-06, user direction)

The `approach` segment no longer follows two Catmull-Rom splines (that swung the view up and diagonally across the ceiling). `skyline/rig.js` now does: a straight, level dolly in from the room view; a turn in place to face the wire side-on, 1.3 m back on the close-up's sight line; a straight push in to the close-up. The end frame is unchanged, so the bundle shot still starts seamlessly. The wire's glowing head still walks the old `FOLLOW_TGT` path.

## Cable realism (2026-11-06, user direction)

The cut → bundle → red-core sequence was reading as flat/2D. Now (`skyline/cable-assembly.js`, `wire.js`):
- The far piece springs away and sags slightly as it parts (`far.position/rotation` from `part`), turning its new cut face toward the camera; that face is a real cross-section (sheath ring, filler, three insulated cores with packed copper). The camera eases ~16° toward the near cut face while the cut opens (`rig.js`, same end pose).
- Inner bedding is opaque matte filler (was a transparent glass tube); its cut face is a solid disc with the three cores through it.
- Sheath: satin PVC with a faint extrusion normal map and a real-style legend (`3 CORE 1.5 SQ MM HR-FR-LSH 1100 V`). Keep the normal scale tiny; at this zoom anything above ~0.04 shows bands.
- Copper (shared by all product chapters): 10-sided round strands, per-strand gauge/tone variation (vertex colours), solid domed cut ends.

## Hero city realism, materials only (2026-11-06, user direction)

Lighting/post (`TUNE` in `skyline/index.js`, `atmosphere.js`) is tuned separately in the `?gui` panel; these changes are surface-only, in `skyline/cityMaterial.js` and `skyline/filler.js`:
- Curtain-wall glass: each 1.2 m x 3.6 m pane (focal tower's mullion grid, phase 0.775) gets its own small tilt and a roller-wave ripple; vertical glass reflects the real sky (`tSky`) with Schlick Fresnel (16% head-on), the city below the horizon. Fades out with `uNight` and `uXray`. Focal-tower panes vary slightly in tint/gloss; about one in twenty shows blinds.
- `metal_alu` (mullions) is anodised mid-grey (0.5, rough 0.5) instead of mirror silver, which drew a bright white grid.
- Filler blocks: three facade types (ribbon, punched, curtain wall), per-building window module, per-window glass variation, shopfront ground floor, glass gloss; a weighted palette of real building tones instead of all pale.
- `grass_lawn`: lush/dry patches, diagonal mowing stripes, fine grain (fades with pixel footprint), slightly muted green.
- Weathering on every opaque city surface (`WEATHER`): rain streaks, street-level dirt, per-face tone, patchy roofs; grime raises roughness. Glass and foliage stay clean. Facade-image glass gets pane tilt/sky reflection only on its dark (glass) pixels (`FACADE_GLASS_MASK`), so panels stay matte. `paint_road` is weathered off-white.

## Scroll smoothness (2026-11-06)

- Render quality per stretch (2026-11-09, `QUALITY` in `scene.js`): the daylight city ("heavy") keeps the reduced ratio below (phones 2x -> 1.5x); from `extend` until `outro` ("light": network, tower room, bundle) the city canvas renders at 2x desktop / 2.5x phones (adaptive floor 1.5x / 2x) with 4x MSAA on the composer's scene targets (`skyline.setMSAA`). Each stretch has its own adaptive step, so a slow daylight city no longer drags the close-ups down; switches wait for a scroll pause. The bundle sheath legend is drawn as a 4x strip (`jacketPrint`, clamped T). Strand labels on phones stack under the chapter copy with drawn leaders (`stackStrandTags` in `main.js`).
- Scroll freezes fixed 2026-11-09 (traced): the 170-1200 ms stalls in the climb and room approach were shader compiles and geometry uploads on first use (three's `compile()` skips hidden objects, and the room/ceiling cable/assembly are hidden at the hero). `warmUp()` in `skyline/index.js` now forces every object visible, `compileAsync`s each scene for its real target/tone mapping, then draws once into a 2x2 target to upload geometry. It runs BEFORE the reveal (loader up, nobody scrolling; capped at 6 s, ~+1.1 s on desktop): run after the reveal it overlapped scrolling and stalled a dusk frame for 2.9 s. The room GLB (arrives after the reveal) is warmed alone (`warmUp(room.group)`). No synchronous `renderer.compile` anywhere on the reveal path. Shadow map re-renders every 1 deg of sun travel on desktop too (was 0.35 deg; dusk dropped frames at 1.5x). Measured after: fresh load, hero -> bundle, 0 frames over 25 ms at 1.5x. Perf scripts in `.perf/` (git-ignored); dev `window.__tamira` has `lenis`, `progress()`, `segmentAt(p)`.
- City canvas capped at 1.5x DPR (product canvas 1.75x) and adaptive: sustained missed frames step it to 1.25x, then 1x, applied only when the scroll pauses (resize reallocates targets), with an immediate redraw so the cleared canvas never shows. Never steps back up. `scene.js` `watchFrame`.
- First-pass freezes came from work done on first sight. `skyline/index.js` `warmUp()` (idle, after the room loads) compiles each scene in the exact state it is drawn (composer target, crossfade target, screen with Neutral/TUNE tone mapping), uploads every texture and allocates the crossfade target. Room GLB `load()` now resolves after its textures. Assembly materials are `transparent` from creation (flipping it later recompiles).
- The red core's tube is rebuilt only when its inputs change (`cable-assembly.js`), not every ambient tick. Leaves skip the night-window block; glass/weathering code compiles only into the materials that use it.
- Camera hero → network is ONE eased move (`S.cam` = cosine ease of rise+scan+net in key space) and `rig.js` passes through the key shots on monotone cubic curves (no overshoot). Per-move easing used to stop the camera at every key: 38% of that scroll moved at <10% of average speed.
- Perf scripts used: wheel-driven frame timing per segment, first vs second pass. GPU contention on this machine made single runs noisy; compare interleaved runs.

## Historical direction to preserve after the product handover

- Live clay city/camera rise and traffic in Three.js, warm orange wireframe, avenue power-up, continuous city-to-product handover.
- Single red core through copper, strands, flex, heat, flame and smoke.
- The **same red wire** connects into the original switchboard's rear (L), then black and green join it into N and E on the source timing (DECISIONS 29). No canvas opacity dip or replacement scene for the red cable.
- Use the original three-wire sequence's camera path and red insertion timing. The added tip-follow camera move was rejected. Only the short smoke-camera bridge is adapted.
- Rendered living room (rebuilt in Blender with realistic CC0 materials, DECISIONS 30), five lighting groups, then the current contact section. It stays 48 pre-rendered images on the original cameras; a live GLB room is a planned follow-up to compare, not yet built.
- **Use Comet** for browser access and visual checks: `agent-browser --executable-path /Applications/Comet.app/Contents/MacOS/Comet --args "--mute-audio,--autoplay-policy=user-gesture-required"` launches a separate, muted automated Comet instance (never run it unmuted: it played music; close it with `agent-browser close` when done) (the user's own Comet window has no debugging port; never restart it). Switch to the site's tab with `agent-browser tab`, because Comet also opens its Perplexity sidecar tab. Be direct; distinguish observed results from assumptions. Do not describe a build or camera-coordinate check as a visual pass.

## Run and stack

```bash
npm install
npm run dev -- --port 5180 --strictPort
npm run build
npm run preview
```

Plain HTML/CSS/JavaScript, Vite 5.4.10, GSAP/ScrollTrigger 3.12.5, Lenis 1.3.27, Three.js 0.170.0. Keep versions pinned. The scene is lazy-loaded after first paint. Dev review: `?at=finale:0.45`, `?at=room:0.55`; the room is the 48 rendered images on every device (DECISIONS 34); `?room=glb` opens the live GLB room on desktop for development only (`src/story/room-live.js` / `room-glb.js`, `public/room-3d/`, lab `/room-lab.html`); runtime helper `window.__tamira.seek(segment,t)` and `.diagnostics()` are development tools.

## Code ownership

| File | Role |
| --- | --- |
| `src/main.js` | Labeled master timeline, lifecycle, copy/palette/overlays, daylight traffic ticker |
| `src/story/timeline.js` | Segment order/pacing and normalized progress helpers |
| `src/story/scene.js` | Two renderers, city/product handover, wire chapter states and finale orchestration |
| `src/story/wire.js`, `props.js` | Cable geometry/materials and chapter props |
| `src/story/finale-stage.js` | Shared product scene/cable, original red rail, camera arc and board-to-room frustum |
| `src/story/original/` | Adapted source board, wall materials, camera table, room painter/view helpers |
| `src/story/finale-timing.js`, `room.js`, `room.json` | Shared ending clock, room loading/lifecycle, source framing metadata |
| `public/room/` | All 48 unchanged source room images |
| `art/data/city-layout.json` | Shared city layout, Z-up metres |
| `src/style.css` | DM Sans everywhere (headings and copy, 2026-11-09 user direction), actual Tamira SVG logo, responsive layout |

Story total: 35.05 scrolling screens plus the sticky stage viewport; `finale` 4 screens, `room` 3 and `outro` 3 (back out of the tower room to the hero tower at sunset; the contact section overlaps that last screen). Story movement is deterministic from progress; daylight traffic is ambient ticker motion. GSAP matchMedia owns reduced-motion teardown/rebuild.

## Critical regression context

The board was hidden every frame by `finaleStage.hide()` while the smoke endpoint was reconstructed. The source `createFinale.update()` originally restored visibility only when its fade changed. With constant fade 1, that left the board invisible. The fix restores `group.visible` every update, outside the material-fade cache. Preserve that fix and the new `boardVisible` diagnostic/assertion.

Latest build passed. Earlier desktop/mobile automation passed room alignment, lighting, one-wire identity and opacity, but missed board visibility. The expanded visibility assertion has not completed a post-fix run. Comet review timed out; rear-board visual confirmation remains open. Real-device profiling and product/contact placeholders remain open.

## Load performance (2026-11-06)

Chrome's Slow 4G preset (180 KB/s, 562 ms): loader gone at ~10.4 s (was ~50 s+); full story ~2.3 MB transferred (was ~11 MB). What changed, so it is not undone:
- `city-v2.glb` is **meshopt-compressed** with 16-bit positions and 8-bit normals (5.3 MB to 1.2 MB raw, 0.22 MB brotli; screenshot diff vs float is below animation noise). `room-v2.glb` keeps float positions, 10-bit normals (0.55 MB). Both loaders call `setMeshoptDecoder`. The scan proxy in `skyline/index.js` takes a float copy of the quantized (interleaved int16) positions before `applyMatrix4`; keep that if the GLB is re-exported.
- City/room textures and the hero posters are WebP (q90 colour, q95 data maps); the sheer-curtain JPGs stay (WebP did not help).
- `vite.config.js` makes `npm run dev`/`preview` serve `.glb`/`.hdr` brotli-compressed like the production host, so local Slow 4G tests match the deployed site. Loader finish is shorter (`src/loader.js`).
- Phones (coarse pointer) load `day-env-256.hdr` instead (2x2 float average of the 512, same mean radiance; 99 KB vs 337 KB brotli; phone hero frame matches the 512 within capture noise). `?hdr=512|256` overrides. Slow 4G phone loader: ~9.9 s to ~9.1 s.
- The sky HDRI is `day-env-512.hdr` (was 1k, 1.3 MB; now 0.4 MB, frame diff vs 1k is below animation noise). It downloads in parallel with the GLB; the opening waits for GLB + HDRI + first-view textures (12 s cap) so nothing pops in under the reveal. The room GLB and its textures load only after the opening is up.
- `index.html` preloads the GLB, HDRI and first-view textures with `fetchpriority="low"` and matching `crossorigin` (without `crossorigin`, the textures download twice). Textures are de-duplicated per file in `skyline/index.js`.
- DM Sans (one variable latin woff2, weights 100-1000, optical size 9-40) is self-hosted (`public/fonts`) and used everywhere, including the canvas-drawn cable legends and board L/N/E labels; it replaced Georgia + Instrument Sans (after brief trials of Arimo, Epilogue and Figtree) on 2026-11-09. Google Fonts is not linked. `vercel.json` sets long cache headers.
- The loader shows time left until the opening (not the full site) under its sentence: bytes still to come (`OPENING_BYTES` in `src/loader.js`, 1.33 MB measured) over download speed. Update `OPENING_BYTES` if the opening's assets change.
- Removed as unused: `public/media/` (20 MB of old hero stills/video), old `city.glb`/`city-2k.jpg`, GeistSerif, `story/city.js`, `story/daylight.js`.

## Documentation

[Current context](docs/CURRENT-CONTEXT.md) · [Story](docs/STORY.md) · [Architecture](docs/ARCHITECTURE.md) · [Design system](docs/DESIGN-SYSTEM.md) · [Room finale](docs/ROOM-FINALE.md) · [Decisions](docs/DECISIONS.md) · [Assets](docs/REFERENCES-AND-ASSETS.md) · [Open items](docs/OPEN-ITEMS.md).

Update the relevant docs with implementation changes. Keep historical decisions as history; the latest user direction takes precedence. Do not regenerate offline assets or change the camera choreography based on an old prompt. Preserve other people's applications and shared Blender sessions. Avoid commits/pushes unless requested.
