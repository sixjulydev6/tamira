> Current direction (DECISIONS 29): the existing red product wire continues into L, and black and green connection wires follow it into N and E on the source timing. The smoke-to-finale canvas fade stays removed. The camera uses the original three-wire path and red-cable insertion timing; the original room assets and room alignment remain.

> Live GLB room (DECISIONS 32): `?room=glb` renders the room live in Three.js with the same camera window, fade and lighting beats; the images stay the default.
>
> Room images (DECISIONS 30): the 48 room frames are now a Blender rebuild with realistic materials on the same cameras, crops, soft edges, lighting steps and rocker states; file names and the painter contract are unchanged.

# Original room finale port

Source: [dsingh-sixjuly/wirecable-showcase](https://github.com/dsingh-sixjuly/wirecable-showcase), commit `9d1eb33fceaaa3f681e3e1e06c198b753f4e965d`.

The user initially selected the original room assets and complete rear three-wire sequence. Later direction supersedes the wire count: preserve the source camera/interaction but connect only the existing red product wire. The added travelling-tip camera move was rejected.

## Original flow reviewed

The source starts with three boxed wire coils. They lift and unwind; red proceeds through copper, the jacket cutaway and flexibility; reels transition into black for heat and green for flame/smoke. Three fresh red/black/green lengths then seat in the back of a wall-mounted switchboard. The camera travels around the wall to the five-switch front plate, matches the rendered room's camera, and pulls out into the living room. Its switches turn on downlights, pendant, sconces, arc lamp and TV-unit strip in that order. The source closes with a Sixjuly studio end card.

This port adapts that ending with one red cable into the current Tamira city/product story. It retains the current earlier chapters, branding, type and final contact section. It does not substitute the source's boxed-coil opener for the current city opener.

## What is reproduced

- Original switchboard/wall geometry, including five rockers, back box, L/N/E terminals, brass screws, procedural wall materials and seating pulses.
- Original finale camera stops and centripetal camera spline, with desktop/portrait positions, adaptive 26° base lens and view drop.
- The existing product wire on the original **red** rail, with the original finale radius, travel and exposed-tip length. Black and green are two more `Wire` instances in the same scene at the same scale (source colours `#161719` / `#1a6633`, source sheen), on the original N/E rails with the source 26-unit travel; hidden until they move. Product and finale share the same scene, red cable instance and renderer. Canvas opacity stays fully on through the connection.
- Source insertions with cubic easing: red (the continuous product wire) seats in L at 6.38–6.50, then fresh black and green lengths slide up into N (6.46–6.58) and E (6.54–6.66), each with its own screw click (red 6.50–6.53, black 6.58–6.61, green 6.66–6.69); camera arc, room handoff, pullback and five lighting states. A smoke-camera/path bridge runs 6.06–6.32; after that the original camera spline/lens/view offset is unchanged. No added tip-follow camera motion.
- Original asymmetric room camera frusta and board alignment math.
- All 48 original room WebP files, unchanged: 2 screen shapes × 4 resolution levels × 6 lighting states, approximately 1.9 MB total on disk. Only the selected shape's 24 files are fetched, starting near the smoke chapter.
- Original room painter, multiresolution crops, soft edge compositing and decode-ahead window. The painter checks HTTP success before accepting an image, and the room overlay waits until the first image is painted.

The room is intentionally the source's rendered-image environment, not newly invented live furniture. Three.js renders the switchboard and single red wire; a Canvas2D painter displays the exact room assets. The existing GSAP master timeline drives both through one shared clock.

## Files and provenance

| File | Role/source |
| --- | --- |
| `src/story/original/finale.js` | Source `src/engine/finale.js`, visibility restoration adapted for the shared scene |
| `src/story/original/surface.js` | Source `src/engine/surface.js`, unchanged |
| `src/story/original/camera-path.js` | Source full `SHOTS` table and spline sampling, extracted from `src/engine/story.js` |
| `src/story/original/roomview.js` | Source `src/engine/roomview.js`, JSON import path adapted |
| `src/story/original/roompaint.js` | Source `src/engine/roompaint.js`, helper import and HTTP validation adapted |
| `src/story/room.json` | Source room geometry/framing metadata, unchanged |
| `public/room/*.webp` | Source `public/room`, byte-identical |
| `src/story/finale-stage.js` | Three.js adapter for shared product renderer/scene/cable, original camera and board handoff |
| `src/story/finale-timing.js` | Shared conversion from current story progress to source story units |
| `src/story/room.js` | Lazy room loading, responsive frame selection, repaint and cleanup |

No React runtime, source typography package or additional WebGL renderer was added. The source's small time-based camera drift is omitted so the ending is deterministic on scroll and reverse. Room imagery and geometry match the original; live wire tessellation/lettering, current page typography and elapsed scroll distance follow the current site.

## Scroll and lifecycle

`finale` now lasts 4 viewport heights and maps source units 6.06–7.06. New `room` lasts 3 viewport heights and maps units 7.06–7.94. The room sequence is: dark board → pullback → downlights → pendant → sconces → arc lamp → cabinet strip → fully lit room → dark fade → current contact section.

The room painter is prepared near smoke. It uses the original `aspect <= 0.8` portrait split and recreates its decoded image set when that split changes. Reverse scroll reuses fetched images and decodes the needed earlier steps. Reduced-motion/no-WebGL layout shows the original fully lit room still after the product copy. Cleanup closes image bitmaps, releases references and disposes finale GPU resources with the story.

## Rear-board visibility regression

`scene.js` calls `finaleStage.hide()` while reconstructing the smoke endpoint on each frame. The source board updater cached `fade` and restored group visibility only if that value changed. With constant `fade: 1`, subsequent frames stayed hidden. The fix sets `group.visible = fade > 0.005` on every update, outside the material-fade cache. `diagnostics().finale` exposes `boardVisible`, `connectionWires`, `wireId` and board projection data. Keep the visibility assertion: matching projected coordinates does not prove meshes are rendered.

## Verification and limits

- Implementation commit `6d33386` is pushed on `bishwa-wire-v1`; its production build passed with the existing large-chunk advisory.
- Earlier SHA-256 checks matched all 48 room images to the supplied repository.
- Earlier automation at 1440×900 and 390×844 measured board-center alignment below 0.01 CSS px and checked one-wire identity, full canvas opacity, lighting progression, reverse/aspect changes and reduced motion. These checks missed the hidden-board regression.
- `scripts/verify-room-finale.mjs` now asserts `boardVisible` as well. That expanded check has not completed a successful post-fix run.
- **Use Comet for browser review.** Comet inspection after the fix encountered DevTools/device-emulation state problems and tool timeouts. A reliable final visual pass of the visible rear box and cable seating is still required.
- Existing CDP scripts use `TASTE_CDP_MODULE`/`CHROME_PATH` and write to ignored `.taste-skill/`; these are historical automation facilities, not a substitute for the requested Comet review.
- Do not describe this as a visually verified exact match. Real-device performance and product/contact placeholders remain open.

Latest handoff: [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md). Next review in Comet: smoke → rear reveal → red seating → front arc → room, then reverse and portrait.
