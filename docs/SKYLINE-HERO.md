# Skyline opening — 2026-11-05

## Accepted scope

Replace only the old clay-city/avenue opening with the shared site's city → room → wire journey. Keep Tamira's current fonts, header, rounded opening frame, headline/sentence/action placement, product copy and all chapters from the single-core wire onward. Do not bring over the supplied React UI, chapter rail, loader or typography. A subsequent user request adds the three-core construction reveal and an explicit red-core extraction before the existing single-wire chapters.

The source is `asset/new-proj-hero/Wire website/temira`, not its sibling `v2` photo-based prototype. `NEXT-CHAPTERS.md` in that project is a proposal, not an instruction to replace our existing product chapters.

## Runtime

The app remains vanilla JavaScript, Three.js **0.170.0**, GSAP **3.12.5**, Vite **5.4.10**, with the same two WebGL contexts. No React, Fiber, Lenis or additional package was added.

`src/story/skyline/` adapts the supplied layout, building/room data, architectural scan shaders, LiDAR extraction, wiring geometry, ground/traffic shaders and camera paths to ordinary Three.js factories. `index.js` owns loading, atmosphere, composer, lifecycle and the bridge. `scene.js` retains the existing product choreography and finale, and no longer imports the old `city.js`/`daylight.js` opener.

| Host segment | Current visual |
| --- | --- |
| `day` | GLB skyline in daylight inside the existing rounded frame |
| `rise` | Frame opens; daylight settles to dusk and windows light |
| `wireOn` | Solid facades dissolve into architectural edges and LiDAR points |
| `extend` | Underground feeders grow outward from the substation |
| `run` | One feeder climbs the riser; a furnished room builds and lights |
| `approach` | Camera passes through the room's open corner and follows the ceiling wire |
| `bundle` | White sheath and bedding retract; red, blue and green cores reveal their copper, with four construction labels |
| `drain` | The red core physically pulls forward while blue/green remain; camera follows into the existing single-core product view |
| `wireIn` onward | Existing copper, strands, flex, heat, flame, smoke, three-wire board and final room |

Total: **32.05** scrolling screens plus the sticky viewport. `approach` is 2 screens, `bundle` 3 and `drain` 2.6; product chapter lengths are unchanged.

## Handover

The ceiling run resolves into a white sheathed cable. `cable-assembly.js` builds the outer sheath, translucent bedding and three independent red/blue/green cores. All use the current wire model, with 30 copper strands per core. A camera orbit and staggered sleeve retraction reveal the construction; labels reuse the host typography and pin treatment, arranged as one desktop row or a phone 2×2 grid.

The red `Wire` object in the assembly remains the same object throughout extraction. During the first half of `drain`, its tip advances out of the assembly while blue and green remain in place. The camera tracks it; later, the red path settles into the existing product entry and the room/other cores recede. Product X maps to skyline Z, Y stays vertical and Z maps to skyline −X. Assembly scale is 0.0875; the individual core scale is 0.0315. Matching normalized camera distance, light directions, environment rotation and wire geometry make the final frame match the existing single-wire canvas.

This supersedes the earlier direct ceiling-wire handover. No flash or visible match cut introduces the single wire. The existing smoke-to-switchboard red/black/green sequence remains unchanged.

Applied the locally supplied `emil-animations` skill: existing GSAP/Three.js stack, coordinated ease-in-out movement, reversible progress-derived state, no per-frame React state, and the existing reduced-motion static path. All 29 supplied skills were installed globally in `~/.codex/skills`; the replaced prior skill has a timestamped backup.

## Assets and lifecycle

- `public/skyline/city.glb`: supplied optimized city geometry, approximately 449 KiB, one mesh.
- `public/skyline/city-2k.jpg`: supplied atlas, approximately 1.53 MiB. The optional 4K atlas is not loaded.
- `public/skyline/poster-{desktop,portrait}.jpg`: opening-view captures for first paint, reduced motion and unavailable WebGL.
- Desktop/portrait camera framing derives from the source. Portrait room introduction pulls farther back so the room fits before the camera enters.
- Bloom and ACES handle the skyline; Neutral tone mapping handles the bridge/product. Static directional shadow maps update with daylight changes. Source traffic, curtains, clouds, points and wiring pulses use the visibility-gated ticker; scrolling determines the story beats.
- Loading keeps the poster visible until the GLB and atlas are ready. A failed load switches to the existing static story. Cleanup releases geometry, materials, textures, shadows and composer targets. Reduced-motion teardown/rebuild is owned by the host GSAP matchMedia lifecycle.

The live tower room belongs to the new opening. The **final living room remains the 48 rebuilt images on all devices**, with the existing optional desktop `?room=glb` development route.

## Review

Use muted Comet and the current dev server:

```
?at=day:0
?at=wireOn:0.9
?at=extend:0.95
?at=run:0.98
?at=approach:0.5
?at=bundle:0.8
?at=drain:0.35
?at=drain:1
?at=wireIn:0.5
?at=copper:0.55
```

`scripts/verify-skyline.mjs` checks 30 frames on each of 1440×900 and 390×844, network/room/follow state, three-core visibility, persistent red identity, red pullout with stationary blue/green, label bounds/non-overlap, reverse seeks, finite camera coordinates, overflow, host font families and reduced-motion teardown/rebuild. Captures/reports are ignored under `.taste-skill/skyline/`. Run the existing `verify-room-finale.mjs` separately to protect board identity, wire counts/opacity, room alignment, lighting and reverse behavior. Browser checks do not establish physical-device GPU performance.
