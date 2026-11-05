# Tamira working brief

Read [docs/CURRENT-CONTEXT.md](docs/CURRENT-CONTEXT.md) first. Updated 2026-11-04; implementation commit `6d33386` is pushed to `origin/bishwa-wire-v1`. This documentation pass is local until explicitly committed/pushed.

## Latest direction (2026-11-05)

The current opener is the supplied GLB skyline → dusk → architectural scan → underground network → tower room → ceiling wire sequence, adapted to vanilla Three.js in `src/story/skyline/`. It now includes a `bundle` construction reveal with red/blue/green cores; the same red core physically pulls out during `drain` and leads into the unchanged single-core product story (DECISIONS 37). Preserve the existing fonts, header, frame and copy layout. Read `docs/SKYLINE-HERO.md`. The clay-city instructions below are historical and do not override this replacement.

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
| `src/story/daylight.js` | Procedural clay city, rise camera, traffic, shadows |
| `src/story/city.js` | Wireframe city, avenue, windows and lamps |
| `src/story/scene.js` | Two renderers, city/product handover, wire chapter states and finale orchestration |
| `src/story/wire.js`, `props.js` | Cable geometry/materials and chapter props |
| `src/story/finale-stage.js` | Shared product scene/cable, original red rail, camera arc and board-to-room frustum |
| `src/story/original/` | Adapted source board, wall materials, camera table, room painter/view helpers |
| `src/story/finale-timing.js`, `room.js`, `room.json` | Shared ending clock, room loading/lifecycle, source framing metadata |
| `public/room/` | All 48 unchanged source room images |
| `art/data/city-layout.json` | Shared city layout, Z-up metres |
| `src/style.css` | Geist Serif headings, Instrument Sans copy, actual Tamira SVG logo, responsive layout |

Story total: 26.85 scrolling screens plus the sticky stage viewport; `finale` 4 screens and `room` 3. Story movement is deterministic from progress; daylight traffic is ambient ticker motion. GSAP matchMedia owns reduced-motion teardown/rebuild.

## Critical regression context

The board was hidden every frame by `finaleStage.hide()` while the smoke endpoint was reconstructed. The source `createFinale.update()` originally restored visibility only when its fade changed. With constant fade 1, that left the board invisible. The fix restores `group.visible` every update, outside the material-fade cache. Preserve that fix and the new `boardVisible` diagnostic/assertion.

Latest build passed. Earlier desktop/mobile automation passed room alignment, lighting, one-wire identity and opacity, but missed board visibility. The expanded visibility assertion has not completed a post-fix run. Comet review timed out; rear-board visual confirmation remains open. Real-device profiling and product/contact placeholders remain open.

## Documentation

[Current context](docs/CURRENT-CONTEXT.md) · [Story](docs/STORY.md) · [Architecture](docs/ARCHITECTURE.md) · [Design system](docs/DESIGN-SYSTEM.md) · [Room finale](docs/ROOM-FINALE.md) · [Decisions](docs/DECISIONS.md) · [Assets](docs/REFERENCES-AND-ASSETS.md) · [Open items](docs/OPEN-ITEMS.md).

Update the relevant docs with implementation changes. Keep historical decisions as history; the latest user direction takes precedence. Do not regenerate offline assets or change the camera choreography based on an old prompt. Preserve other people's applications and shared Blender sessions. Avoid commits/pushes unless requested.
