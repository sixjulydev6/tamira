> Current direction: the existing single red product wire continues into the red terminal. The black/green cable sequence and the smoke-to-finale canvas fade are removed. The camera uses the original three-wire path and red-cable insertion timing; the original room assets and room alignment remain.

# Original room finale port

Source: [dsingh-sixjuly/wirecable-showcase](https://github.com/dsingh-sixjuly/wirecable-showcase), commit `9d1eb33fceaaa3f681e3e1e06c198b753f4e965d`.

The user requested the original room and explicitly selected both the original rendered assets and the complete rear switchboard connection sequence.

## Original flow reviewed

The source starts with three boxed wire coils. They lift and unwind; red proceeds through copper, the jacket cutaway and flexibility; reels transition into black for heat and green for flame/smoke. Three fresh red/black/green lengths then seat in the back of a wall-mounted switchboard. The camera travels around the wall to the five-switch front plate, matches the rendered room's camera, and pulls out into the living room. Its switches turn on downlights, pendant, sconces, arc lamp and TV-unit strip in that order. The source closes with a Sixjuly studio end card.

This port brings that complete ending into the current Tamira city/product story. It retains the current earlier chapters, branding, type and final contact section. It does not substitute the source's boxed-coil opener for the current city opener.

## What is reproduced

- Original switchboard/wall geometry, including five rockers, back box, L/N/E terminals, brass screws, procedural wall materials and seating pulses.
- Original finale camera stops and centripetal camera spline, with desktop/portrait positions, adaptive 26° base lens and view drop.
- Three red, black and green wires on the original rail paths, with original radius, travel and exposed-tip length. They use the current site's procedural strand/jacket engine and legend font.
- Original source beat times for connection, camera arc, camera handoff, room pullback, five cumulative lighting states and final fade.
- Original asymmetric room camera frusta and board alignment math.
- All 48 original room WebP files, unchanged: 2 screen shapes × 4 resolution levels × 6 lighting states, approximately 1.9 MB total on disk. Only the selected shape's 24 files are fetched, starting near the smoke chapter.
- Original room painter, multiresolution crops, soft edge compositing and decode-ahead window. The painter checks HTTP success before accepting an image, and the room overlay waits until the first image is painted.

The room is intentionally the source's rendered-image environment, not newly invented live furniture. Three.js renders the switchboard and wires; a Canvas2D painter displays the exact room assets. The existing GSAP master timeline drives both through one shared clock.

## Files and provenance

| File | Role/source |
| --- | --- |
| `src/story/original/finale.js` | Source `src/engine/finale.js`, unchanged |
| `src/story/original/surface.js` | Source `src/engine/surface.js`, unchanged |
| `src/story/original/camera-path.js` | Source full `SHOTS` table and spline sampling, extracted from `src/engine/story.js` |
| `src/story/original/roomview.js` | Source `src/engine/roomview.js`, JSON import path adapted |
| `src/story/original/roompaint.js` | Source `src/engine/roompaint.js`, helper import and HTTP validation adapted |
| `src/story/room.json` | Source room geometry/framing metadata, unchanged |
| `public/room/*.webp` | Source `public/room`, byte-identical |
| `src/story/finale-stage.js` | Three.js adapter for current renderers, wires, original camera and board handoff |
| `src/story/finale-timing.js` | Shared conversion from current story progress to source story units |
| `src/story/room.js` | Lazy room loading, responsive frame selection, repaint and cleanup |

No React runtime, source typography package or additional WebGL renderer was added. The source's small time-based camera drift is omitted so the ending is deterministic on scroll and reverse. Room imagery and geometry match the original; live wire tessellation/lettering, current page typography and elapsed scroll distance follow the current site.

## Scroll and lifecycle

`finale` now lasts 4 viewport heights and maps source units 6.06–7.06. New `room` lasts 3 viewport heights and maps units 7.06–7.94. The room sequence is: dark board → pullback → downlights → pendant → sconces → arc lamp → cabinet strip → fully lit room → dark fade → current contact section.

The room painter is prepared near smoke. It uses the original `aspect <= 0.8` portrait split and recreates its decoded image set when that split changes. Reverse scroll reuses fetched images and decodes the needed earlier steps. Reduced-motion/no-WebGL layout shows the original fully lit room still after the product copy. Cleanup closes image bitmaps, releases references and disposes finale GPU resources with the story.

## Verification

- Build and syntax checks.
- SHA-256 comparison of all 48 room assets against the supplied repository.
- Desktop/portrait camera handoff: projected board center compared against the room metadata's starting window; error below 0.01 CSS px in measured 1440×900 and 390×844 views.
- Browser checks and screenshots: rear connections, front board, all five lighting states, fully lit room, reversing to the board/hero, aspect changes mid-room and reduced-motion fallback.
- `scripts/verify-room-finale.mjs` writes its measurements/screenshots to `.taste-skill/room-finale/`. It requires Vite on port 5180 and the installed taste-skill CDP helper, configurable through `TASTE_CDP_MODULE`; `CHROME_PATH` selects the browser.

Real-device performance remains unmeasured. Product specification and contact placeholders remain as listed in `OPEN-ITEMS.md`.
