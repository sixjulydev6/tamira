# Current project context

Updated 2026-11-04. This is the current handoff; historical plans and decisions do not override it.

## Repository and delivery

- Working repository: `akhil515435-design/tamira-site`; branch `bishwa-wire-v1`.
- Latest pushed implementation: [`6d33386`](https://github.com/akhil515435-design/tamira-site/commit/6d33386), “Build live city and single-wire switchboard room finale”. This documentation update follows that commit and is not yet pushed.
- Reference repository: [dsingh-sixjuly/wirecable-showcase](https://github.com/dsingh-sixjuly/wirecable-showcase), inspected at `9d1eb33fceaaa3f681e3e1e06c198b753f4e965d`. Its local checkout was `/tmp/tamira-original-showcase`; that temporary path is not a project dependency.
- Use **Comet** for browser access and visual review, per the user's explicit preference. Do not silently substitute a separate Chrome session. Existing CDP verification scripts record earlier checks; they are not proof of a Comet review.

## Current experience

The hero is a rounded media frame (Integrated Biosciences composition, DECISIONS 27): the street-level clay city on a daylight sky, headline top-left, sentence bottom-left, two-part button bottom-right, wordmark plus frosted nav panel above. Typefaces are unchanged. On the first scroll the frame opens to full screen (`rise` 0–0.35). A live Three.js camera rises into the isometric city, which turns into a warm orange wireframe. A red single-core house wire powers the avenue and building windows, then the city drains away into the product chapters: copper, strands, flexibility, heat, flame and smoke.

After smoke, **the same red product wire** continues into the back of the original five-switch board and seats in L; then fresh black and green lengths slide up into N (6.46–6.58) and E (6.54–6.66), each with its own screw click (red 6.50–6.53, black 6.58–6.61, green 6.66–6.69) (DECISIONS 29). Keep the product canvas fully visible through this transition: no fade-out/fade-in or scene swap.

The user rejected the added travelling-tip camera movement. The current adapter uses a short bridge from the current smoke camera over source time 6.06–6.32, then the original three-wire sequence's camera path, adaptive lens/view offset and red insertion timing. No added tip-follow translation or delayed camera spline sampling. Red insertion runs 6.38–6.50 with the source cubic easing; the red screw/pulse runs 6.50–6.53. The original camera arc continues to the front plate and matches the rendered room.

The room deliberately uses the original 48 WebP assets and Canvas2D painter, not newly built live furniture. Pullback reveals five cumulative lighting groups: downlights, pendant, sconces, arc lamp, TV-unit strip. The room close still darkens before the contact section; the no-fade request applies to the smoke-to-switchboard cable continuity.

## Implementation and timing

- Plain Vite 5.4.10, Three.js 0.170.0, GSAP/ScrollTrigger 3.12.5; keep pinned versions.
- Two WebGL renderers: daylight/wireframe city, and product cable/switchboard. The finale shares `wireScene` and the existing `Wire` object; it adds no WebGL context.
- `src/story/daylight.js`: procedural PBR city, 37 buildings including crown, 1,721 instanced windows, 54 moving cars. Live rise and traffic; old rise frames/videos are retained but not requested by normal browsing.
- `src/main.js`: labeled GSAP master timeline, palette/copy/overlays, traffic ticker and responsive/reduced-motion lifecycle.
- `src/story/finale-stage.js`: same-wire path/scale morph, original camera path, board handoff and diagnostics.
- `src/story/original/finale.js`: original board/wall, adapted visibility restoration. `scene.js` hides the board while reconstructing the smoke endpoint each frame; `update()` must restore `group.visible` on **every call**, even when `fade` is unchanged. A cached fade value previously left the entire board hidden.
- `src/story/finale-timing.js`: `finale` maps 6.06–7.06; `room` maps 7.06–7.94. Handoff interpolation is 6.90–6.985; room overlay waits for a painted frame and enters over 6.99–7.06.
- Segment lengths come from `timeline.js`: 26.85 scrolling screens plus the sticky stage's extra viewport. `finale` is 4 screens; `room` is 3.
- Source room assets, geometry metadata and asymmetrical frustum alignment are retained. `room.js` loads the selected aspect's 24 images near smoke and handles reverse/aspect changes.

## Verification and remaining work

- Latest implementation production build passed before commit/push; Vite reported its existing >500 kB chunk advisory. A build is not visual validation.
- Earlier desktop 1440×900 / portrait 390×844 automated checks passed single-wire identity, full canvas opacity, room lighting progression, reverse scrolling, reduced motion and room camera alignment. Measured board-center errors were approximately 0.0064 / 0.0038 CSS px. Those coordinate checks missed the hidden-board regression.
- The visibility fix is included in `6d33386`. `scripts/verify-room-finale.mjs` now asserts `boardVisible`, but the expanded assertion has **not been rerun successfully after that fix**.
- Comet inspection was attempted after the fix. DevTools/device-emulation state and tool timeouts prevented a reliable completed visual review. Do not claim the switchboard rear or whole transition has passed final Comet validation.
- Next review: Comet, normal viewport, smoke → approach → visible rear box/red seating → front arc → room; repeat backwards and on portrait. Confirm framing, motion amount, rear visibility, opacity continuity and room handoff.
- Real-device performance, final clay look sign-off, real product specifications, navigation destinations, brand font sign-off, favicon and contact address remain open. Old public media still ships and needs a separate reviewed cleanup.

See [STORY.md](STORY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROOM-FINALE.md](ROOM-FINALE.md) and [OPEN-ITEMS.md](OPEN-ITEMS.md).
