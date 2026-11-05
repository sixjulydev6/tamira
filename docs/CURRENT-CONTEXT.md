# Current project context

Updated 2026-11-05. The skyline hero integration below supersedes the earlier clay-city opener.

## Repository and delivery

- Working repository: `akhil515435-design/tamira-site`; branch `bishwa-wire-v1`.
- Historical pushed implementation: [`6d33386`](https://github.com/akhil515435-design/tamira-site/commit/6d33386), “Build live city and single-wire switchboard room finale”. Local commit `798e73c` contains the subsequent hero/room work. Its push was blocked by automatic approval review pending explicit authorization for the configured GitHub destination. The new skyline integration is not committed.
- Reference repository: [dsingh-sixjuly/wirecable-showcase](https://github.com/dsingh-sixjuly/wirecable-showcase), inspected at `9d1eb33fceaaa3f681e3e1e06c198b753f4e965d`. Its local checkout was `/tmp/tamira-original-showcase`; that temporary path is not a project dependency.
- Use **Comet** for browser access and visual review, per the user's explicit preference. Do not silently substitute a separate Chrome session. Existing CDP verification scripts record earlier checks; they are not proof of a Comet review.

## Current experience

The existing rounded frame, header, Geist Serif headings, Instrument Sans copy, headline top-left and bottom sentence/action layout remain. The visual story now adapts the supplied `asset/new-proj-hero/Wire website/temira` project: GLB skyline in daylight → dusk and lit windows → architectural x-ray/LiDAR scan → underground network → a single feeder up the tower → furnished room building and lighting → camera follows the ceiling wire. The white ceiling cable opens into a construction reveal with red, blue and green cores. The same red core then physically pulls out while blue/green stay put, and the camera follows it into the existing single-wire product entry. Copper, strands, flex, heat, flame, smoke and the switchboard/room finale retain their previous choreography and content. The supplied React UI is not imported; the three-core construction is rebuilt in vanilla Three.js with host materials and typography. See [SKYLINE-HERO.md](SKYLINE-HERO.md).

After smoke, **the same red product wire** continues into the back of the original five-switch board and seats in L; then fresh black and green lengths slide up into N (6.46–6.58) and E (6.54–6.66), each with its own screw click (red 6.50–6.53, black 6.58–6.61, green 6.66–6.69) (DECISIONS 29). Keep the product canvas fully visible through this transition: no fade-out/fade-in or scene swap.

The user rejected the added travelling-tip camera movement. The current adapter uses a short bridge from the current smoke camera over source time 6.06–6.32, then the original three-wire sequence's camera path, adaptive lens/view offset and red insertion timing. No added tip-follow translation or delayed camera spline sampling. Red insertion runs 6.38–6.50 with the source cubic easing; the red screw/pulse runs 6.50–6.53. The original camera arc continues to the front plate and matches the rendered room.

The final room uses the 48 rebuilt Blender room images and the existing Canvas2D painter on every device (decision 34). This ending is separate from the new live room inside the skyline tower. Pullback reveals five cumulative lighting groups: downlights, pendant, sconces, arc lamp, TV-unit strip. The room close still darkens before the contact section; the no-fade request applies to the smoke-to-switchboard cable continuity.

## Implementation and timing

- Plain Vite 5.4.10, Three.js 0.170.0, GSAP/ScrollTrigger 3.12.5; keep pinned versions.
- Two WebGL renderers: the supplied skyline/scan/network/tower-room sequence, and product cable/switchboard. The finale shares `wireScene` and the existing `Wire` object; it adds no WebGL context.
- `src/story/skyline/`: vanilla Three.js adaptation of supplied city, scan, network, room and camera code. `daylight.js` and `city.js` are retained historical implementations and no longer imported by the normal story.
- `src/main.js`: labeled GSAP master timeline, palette/copy/overlays, traffic ticker and responsive/reduced-motion lifecycle.
- `src/story/finale-stage.js`: same-wire path/scale morph, original camera path, board handoff and diagnostics.
- `src/story/original/finale.js`: original board/wall, adapted visibility restoration. `scene.js` hides the board while reconstructing the smoke endpoint each frame; `update()` must restore `group.visible` on **every call**, even when `fade` is unchanged. A cached fade value previously left the entire board hidden.
- `src/story/finale-timing.js`: `finale` maps 6.06–7.06; `room` maps 7.06–7.94. Handoff interpolation is 6.90–6.985; room overlay waits for a painted frame and enters over 6.99–7.06.
- Segment lengths come from `timeline.js`: 32.05 scrolling screens plus the sticky stage's extra viewport. `finale` is 4 screens; `room` is 3.
- Source room assets, geometry metadata and asymmetrical frustum alignment are retained. `room.js` loads the selected aspect's 24 images near smoke and handles reverse/aspect changes.

## Verification and remaining work

- Production build passes with the existing large-chunk advisory.
- `verify-skyline.mjs` passed in muted Comet at 1440×900 and 390×844: 30 frames per viewport, loaded network/room/follow state, three-core visibility, same-red identity and extraction, stationary blue/green cores, bounded/non-overlapping labels, finite cameras, reverse seeks, overflow, unchanged font families and reduced-motion teardown/rebuild. Desktop and portrait screenshots were inspected.
- `verify-room-finale.mjs` passed in muted Comet after integration: board visibility, 1/2/3 wire counts, continuous red cable identity/opacity, seven lighting checks per viewport, reverse, aspect changes and reduced motion. Board handoff errors remain approximately 0.0064/0.0038 CSS px. Older pending-board-verification statements in historical docs are superseded.
- The room-to-product bridge endpoint was compared visually with the product entry. Both use matching wire geometry, camera and lighting; no full physical-device profiling is claimed.
- A design hook's contrast warning exposed the existing Contact CTA's 4.05:1 white/red contrast. Its red now matches the existing hero arrow, giving 4.65:1. No finding was suppressed; typography and layout are unchanged.
- Still open: physical-device GPU performance, confirmed product specifications, navigation destinations, licensed brand-font sign-off, favicon, real contact address, deployment and reviewed old-media cleanup. The optional ending-room GLB remains a development route; its earlier breakage is not resolved by this opening change.

See [SKYLINE-HERO.md](SKYLINE-HERO.md), [ROOM-FINALE.md](ROOM-FINALE.md) and [OPEN-ITEMS.md](OPEN-ITEMS.md).
