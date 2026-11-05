> Current direction and verification limits: [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md). This log records historical choices; later numbered decisions supersede earlier ones.

# Decisions log

This is a record of client direction and design decisions, in order. All entries are from **2026-11-04** unless noted. When a later decision replaces an earlier one, the earlier entry is marked *(superseded)*.

## Before this repo
- A 32-second city → cable → Earth story prototype in Three.js and a lighting study were explored in the source project (`tamira-reference-match/web/`).
- **Scope narrowed:** the client narrowed the scope to a hero.
- **Rejected:** an earlier "wave" transition (`transition_compose.py`).
- **Hero direction chosen:** a warm daylight isometric city with an orange crown tower (Blender style `v1`), plus a day → night video scrubbed by scroll *(superseded, see entry 11)*.

## 1. Grid and composition from arrakis.tech
- **Request:** study arrakis.tech with REA for its grid, margins, text placement, weights, tracking and leading. Don't take its fonts or imagery.
- **Done:**
  - an 84rem container on a 4px base, with 20 / 48px side padding
  - an 86px header with the nav grouped beside the wordmark and Contact as a button on the right
  - the headline bottom-left with 40 / 48 / 96px bottom padding and a 52px desktop indent
  - a fluid type scale with −0.03em heading tracking
- **Kept as ours:** our fonts, and 100svh hero height (because the hero is pinned).
- **Not copied:** its subheading and second CTA (we had no copy for them); its all-caps mono labels (they break our rules).

## 2. Story flow from the Sixjuly wire concept
- **Request:** study wirecable-showcase.vercel.app (a Sixjuly concept with a fictional Tamira brand) and continue the homepage with its flow.
- **Adopted from it:** the chapter order (copper → strands → flex → heat → flame → smoke → finale) and the copy. Its specs are illustrative and need replacing (see [OPEN-ITEMS.md](OPEN-ITEMS.md)).
- **Technique learned from it:** the reference is React + Three.js with fully procedural geometry, a per-segment scroll pacing table, and a pre-rendered room finale. We use a similar pacing table.

## 3. Storyboard PDF ("MacBook Air - 17.pdf")
- **What it showed:** an isometric day city → a street-level cyan wireframe night city → a light lavender page with a cable entering from the bottom-left.
- **Client clarifications:**
  - The PDF is **mood and camera direction only**. Keep our own isometric render and our composition (text left, visual right).
  - The street-level view describes camera movement, not a literal frame.
  - The product is **single-core household wire, focused on copper**, not the multi-core cable shown in the PDF.
  - Night vanish: use the recommended method (the network drains toward a point, then the cable takes over) *(superseded in part, see entry 5)*.

## 4. Built in live 3D instead of new Blender renders
- **Decision:** instead of rendering the wireframe, camera dive and drain in Blender, the city layout and camera were ported from `hero_day.py` to Three.js. The wireframe then sits pixel-for-pixel on the render.
- **Result:** no shared-machine render time, and one renderer from wireframe to wire.
- **Also built:** the procedural wire, with its chapters and props.

## 5. Extend the city; the wire replaces the train
- **Request:** once in wireframe, extend the cityscape like the client's references (isometric blocks with a train on an elevated track). The wire runs **in place of the train, without a platform or bridge**. Street lights on both sides light up with a glow as the wire moves. The same wire becomes the product wire.
- **Done:**
  - an extended generated city and an avenue on the diagonal
  - the wire running at street level
  - street lights switching on as the tip passes
  - an exact hand-over to the product wire via the mapping M
- **Changed as a result:** the earlier "drain to the bottom-left corner, then a new wire enters" was replaced by draining into the wire's tip.

## 6. Buildings light up too
- **Request:** buildings should light up along with the street lights.
- **Done:** a power front spreads from the avenue. Lit buildings turn warm and fill with windows that switch on one by one.
- **Tuning:** window brightness was reduced after the wide view washed out.

## 7. Sync with the wire; fewer street lights
- **Feedback:** the lights were coming on before the wire arrived.
- **Fixed:**
  - the power front now sits exactly at the tip during the run and only spreads further after the wire stops
  - street lights switch on exactly when the tip reaches them
  - street lights halved (every 36 m instead of 17 m)

## 8. Remove the "train ride"
- **Feedback** (from a screen recording, reviewed frame by frame): the camera dropped behind and above the wire and looked up the avenue, which felt like riding a train. It then swung 90° back to the side.
- **Decision (approved plan):** remove that street-level segment and its hold. Replace them with **one continuous push-in** from the diagonal city view to a close side view of the cable. The camera turns at most about 45° and never goes behind the wire.
- **Follow-up:** buildings were cleared from the near-side patch the camera crosses.

## 9. The city goes away sooner
- **Feedback** (with a screenshot of the close diagonal frame): when that frame arrives, the city should go and the page should turn light, quickly. It was lingering.
- **Done:** the approach now ends on that frame. The city drains within the first quarter of the drain, and the page is fully lavender by about 40%. The tip lifts only after the city has gone.

## 10. Earlier tuning (same day)
- **Jacket:** the jacket rendered mauve because of an inside-out tube winding; fixed. The legend texture was re-proportioned.
- **Drain:** the drain and lavender fade were re-timed so the glow never sits on a light page.
- **Colour management:** fixed a colour-space bug (the ground was darker than the page) and added the backdrop quad.
- **Labels:** strand labels got a background so they're legible over the copper.

## 11. Day straight to wireframe; no night
- **Request:** start with the day city and keep it. On the first scroll the whole city transitions into wireframe mode. Skip the night stage, because the city was being lit twice.
- **Done:**
  - the day → night video removed, so the hero is the still day render
  - the page goes white → navy as the lines draw on
  - the glow and white headline only once the page is dark
  - the story is about 1.5 screens shorter
  - the 11.5 MB video no longer loads

## 12. Clay / ceramic finish for the day hero
- **Request:** rebuild the hero city's material, lighting and finish to match the client's clay / ceramic references (brief: `prompt.md`). Keep the city, the crown, the composition and the website as they are.
- **Done:**
  - `art/blender/build_city.py`: the same layout and camera as `hero_day.py`, with real bevels and weighted normals, the crown modelled as one solid, raised window insets, satin dielectric materials, one soft key with a neutral sky fill and no orange point light, and no DOF.
  - Rendered on the team machine at 2560×1440, shipped as AVIF/WebP/JPG at 2560 and 1920 through `<picture>`.
  - A layout manifest (`art/data/city-layout.json`) and two release checks: wireframe vs render layout, and old vs new edge alignment (shift 0, 0).
- **Kept:** the 16:9 frame (the 3D hand-over depends on it), the CSS mask, the scroll story.
- **Not done (by the brief's own rule):** the GLB / realtime branch. The hero is static, so the render is enough. Also not done: a separate portrait render for phones. The crown already survives the phone crop, and a different frame would need a second camera mapping in `scene.js`.

## 13. Sharper hero, deeper shadows
- **Feedback:** the city visual should not pixelate, and the shadows are too light; it should look more dramatic and dynamic.
- **Cause of the softness:** on Retina screens the hero is drawn 2900–3700 device px wide, but the largest file was 2560, so it was upscaled up to 1.43×. AVIF at quality 72 added blocking on top.
- **Done:**
  - The master is now 3840×2160, served as 3840 / 2560 / 1920 (AVIF, WebP, JPG) at higher quality. Resizing uses `sips` instead of Blender's aliasing `image.scale`.
  - Light: lower sun (30° instead of 42°) for long raking shadows, crisper key (3°), sky fill cut from 0.38 to 0.13, AgX Medium High Contrast. The shadows are deep grey, not crushed black.
- **Considered:** `d1` (fill 0.20, sun 34°) was more dramatic than before but still soft. `d2`, the version chosen, is what shipped.

## 14. Framed hero that opens into the immersive city
- **Request:** study incident.io's hero with REA (centred headline over a large framed panel that grows on scroll) and use it for our hero: the cityscape in the frame, in the centre; on scroll the frame takes over the screen as an immersive city, then the existing wireframe → wire story continues. Built with the taste-skill rules.
- **What REA showed:** a 200vh hero with a sticky full-screen pin; the headline lifts ~15px and fades; the frame's window is a scroll-driven `clip-path: inset()` between an 88px top and 24px bottom pin. Their frame holds gradients, blurred blobs and product mock-ups; ours holds only the city.
- **Done:** new `open` segment (1.2 screens) after `day`; centred headline + one sentence + one "Talk to us" button; the city in a square-cornered frame with equal side margins that runs to the bottom of the viewport (client follow-up: "it should fill to the bottom of the viewport"; the static reduced-motion layout does the same); the frame opens to full bleed and holds; CSS masks removed and the shaders' mask copy switched off. Alignment with the wireframe is unchanged because the image reaches its full-screen identity before `wireOn`.
- **Client choices (recommendations accepted):** centred headline; the sentence "Tamira makes copper house wire for homes and buildings: safe, flexible, and built to last."; one button to contact; a still full-screen hold (no push-in).
- **Replaces:** the bottom-left headline with the city masked into the right of the frame, and the phone layout with the city above the headline.

## 15. Traffic in the hero city
- **Request:** animate the framed hero so it feels lively, "like some car been driven on the road like one of the references", rendered and animated on the team Blender.
- **Done:**
  - `art/blender/animate_city.py`: the same city, look and camera as the still (`build_city.py` in a new `anim` mode, without the parked cars), plus 24 instanced clay cars (1.4× scale so they read at hero size, keep left, ~40 km/h).
  - A seamless 10 s loop (240 frames at 24 fps): every lane's traffic is one pattern repeated every 110 m, so after one loop each car sits where the next one started. Cars wrap only off-frame or behind a building (checked by ray cast), and are collision-checked in every frame.
  - Rendered as full Cycles frames with a fixed seed: the static city is identical frame to frame (only ~0.8% of pixels change, the cars), so no plate compositing was needed.
  - Shipped as a 2560×1440 video (AV1 WebM + H.264 MP4) inside the hero frame. Frame 0 is the new poster still (`hero-city-*`), so the video fades in without a jump. It plays only while the city is on screen and pauses once the wireframe takes over; reduced motion and Save-Data keep the still.
- **Client choice:** 2560×1440 (recommended) over 3840 (2–3× the weight) or 1920 (soft on Retina).
- **Changes the rule** "no ambient motion": the hero loop is the one exception, asked for by the client.
- **Known gap:** the framed (resting) hero shows only the top band of the city, where there are few routes; most traffic is on the lower streets that appear as the frame opens. Adding traffic to the top streets was offered, not yet done.

## 16. Geist Serif for the hero headline
- **Request:** replace the Georgia hero font with Geist Serif.
- **Done:** self-hosted Vercel's Geist Serif (variable woff2 from the `geist` npm package 1.9.0, SIL OFL 1.1, 40 KB) and preloaded it; the hero keeps its measured sizes. It isn't on Google Fonts, hence the local file.
- **Follow-up request:** the same font and margins on the rest of the site. **Client choices (recommendations accepted):** Geist Serif on headings only (chapter titles, Contact title, gauge number; body and UI stay Instrument Sans, as in the hero), and every content edge on the framed city's side margin (`--content-x`), replacing the 52px `--indent`. Then, on request, the header too: the wordmark, the Contact button and the phone menu sit on `--content-x`, so the navbar, the frame and all content share one edge.
- **Also fixed:** the gauge's 70°C / 85°C labels overlapped; both now end at their tick.

## 17. Warm wireframe instead of blue
- **Request:** the wireframe section was blue; change it to the hero's warm, orange theme, including its animations.
- **Done:** page night `#060d1f` → `#140b07` (deep warm brown); lines `#1c8fff` / `#8fe9ff` → crown orange `#e8582a` / peach `#ffc69c`; hull lift tint blue → warm; the wire tip's cyan glow → ember orange (cooling to copper at the hand-over as before).
- **Kept the power-up readable:** the lit state used to be warm against a cyan city. With an orange city it now goes to warm white: lit outlines `(1.0, 0.86, 0.64)`, golden windows, warm-white street lamps. So the wire still visibly switches the city on.
- **Not changed:** the light product pages (lavender `#e4e4ee` and chapter tints) and the hero.

## 18. Thick building edges, faint interiors
- **Request:** keep some strokes thick, mainly the building edges; the lines inside buildings and structures at lower opacity.
- **Done:** building outlines (contours, crown, extended blocks) are now screen-space strips 1.2 px wide (crown 1.4, extended city 1.0; first 1.7 / 2.0 / 1.4, reduced on request), with a 0.5 px soft edge, with the same reveal, drain, mask and power-up shading as the lines. Interior lines dropped to about half: window grids 0.42 → 0.2 and 0.62 → 0.3, crown grid 0.7 → 0.32, extended-city grid 0.17 → 0.09. The edges' brightness was lowered too (contour 1.0 → 0.62, crown 1.6 → 0.95), because thicker strokes feed the bloom more.

## 19. Only the windows light up
- **Feedback:** when the wire powers a building, its edges were lighting up too; only the windows should.
- **Done:** powering a building no longer changes its lines (they used to shift orange → warm white and brighten 15%) and no longer adds the faint wall glow. Only the golden windows switch on, one by one, as before. Street lamps are unchanged. Supersedes the "lit outlines" part of entry 17.

## 20. Street-level hero that rises to the isometric view
- **Request:** drop the framed hero for a whole cityscape scene, using the same asset and changing only the camera (reference: a tower seen at eye level, centred, rising into a headline against white sky); the orange crown tower is the main building; on scroll, go back to the isometric view, then continue the story.
- **Found:** from the iso side (−45°…−60°) the tower is 30–50% hidden behind a white tower; from −90° it's 93% visible (ray-cast scan). The asset has windows only on its camera-facing sides, which −90° also faces.
- **Client choices (recommendations accepted):** 50 mm, camera low (35 m) over a 60 mm higher option; the tower in front of the headline (as the reference) over headline-above; distant ground faded to white over keeping a grey horizon.
- **Done:** `animate_city.py` jobs `rise` / `riseposter` / `risewebp` (same scene as the traffic loop at its frame 0; sky transparent; ground fades beyond the isometric frame; dolly-zoom from perspective into the exact orthographic camera). The site: full-bleed hero, scroll-scrubbed frames, headline between the layers, sentence + button in the left column, phone skyline fit. The wireframe hand-off is unchanged (the isometric layer is the same image). Segment `open` → `rise` (1.6 screens).
- **Replaces:** the framed hero (entry 14). `--content-x` keeps the old frame's margin formula for the page grid.

## 21. The real logo
- **Request:** use `asset/tamira-logo.svg` as the site logo.
- **Done:** the SVG (single colour `#F45E5E`, no scripts) is served as `public/tamira-logo.svg` in the header link, 20px tall, on `--content-x`. The live-text Quicksand wordmark and the Quicksand font request are gone.
- **Open:** on the dark wireframe the coral logo reads weaker than the white nav (OPEN-ITEMS).

## Rejected or replaced along the way
- The "wave" transition (client, before this repo).
- A matched-frame Blender camera dive into a wall as the city → wire hand-over. It was replaced by the live-3D hand-over.
- A dark studio background for the wire chapters (as in the reference). The chapters are on a light lavender page, per the storyboard.
- Centred chapter copy (as in the reference). We keep copy in the left column.
- A multi-core cable (as in the storyboard). The product is single-core house wire.
- The street-level "train ride" camera shot.
- The day → night video and the night city.
- The cyan-on-navy wireframe (replaced by orange on a warm night, entry 17).
- The framed hero that opened to full screen (replaced by the street-level rise, entry 20).
- The soft, foggy `hero_day.py` v1 finish (strong DOF, orange glow light). It was replaced by the clay / ceramic render (entry 12).

## 22. Live Three.js city and GSAP interactions
- **Request:** create the complete 3D assets and interactions with Three.js and GSAP.
- **Done:** `src/story/daylight.js` builds the solid city directly from the shared layout manifest: 36 surrounding buildings, the six-arm crown with a central opening, 1,721 instanced window insets, roads, ceramic trees and 54 moving cars. Beveled geometry, satin PBR materials, environment lighting and static directional shadows replace the offline daylight view during normal browsing.
- **Camera:** continuous perspective-to-isometric rise, reproducing the existing opening camera and 16:9 cover crop, including the phone skyline fit. The same city renderer then renders the existing warm wireframe, powering windows and cable journey. There is no rise-frame or traffic-video playback.
- **GSAP:** one labeled master timeline controls all story segments; the GSAP ticker runs traffic only while the daylight city is visible. `matchMedia` handles reduced motion, including live preference changes. Cleanup disposes GPU resources and listeners; context loss falls back to the static story.
- **Kept:** Geist typography, actual SVG logo, current headline layering, story chapter content, procedural cable, conduit, heater, flame, smoke and switch plate. Existing renders remain as fallbacks/source references; no Blender assets were deleted.
- **Also fixed:** portrait heat gauge moved above the heater to keep the temperature readable.
- **Limit:** this is rasterized realtime PBR, not Cycles path tracing. Indirect bounce, penumbra and material response differ from the offline render. Real-device GPU performance and final look sign-off remain outstanding.

## 23. Port the original switchboard and living-room finale
- **Request:** inspect the supplied `dsingh-sixjuly/wirecable-showcase` repository and implement its complete room ending.
- **Choices confirmed:** reuse the original rendered room for an exact visual match, and include the rear three-wire connection sequence before entering it.
- **Done:** original five-switch board, wall materials, L/N/E seating and click pulses; red/black/green wires on the source rails; original camera spline and matched room handoff; original room images, pullback, five lighting steps and dark close. New `room` segment follows the expanded `finale` segment, then the current contact section.
- **Implementation:** current Three.js/GSAP stack, no React migration, no added WebGL context. Original room imagery is rendered offline and painted on Canvas2D exactly as in the source. Full provenance, scope and validation are in `ROOM-FINALE.md`.

## 24. Single continuous wire at the switchboard (2026-11-04)
This direction superseded the three-wire count; its added tip-follow movement was then superseded by decision 25. Reuse the existing product cable and scene, morph its world-space path into the original red terminal rail, and track its tip continuously. No black/green cables, scene replacement, or canvas opacity dip. The original board camera arc and rendered room ending remain. Reconstruct the smoke endpoint on each seek so reverse scrolling and resizing are deterministic.

## 25. Restore original finale motion (2026-11-04)
Use the original three-wire camera path, view offset and cubic red-wire insertion timing, with only one red cable. Remove the added tip-follow camera translation and delayed path sampling. A short smoke-camera bridge ends at source time 6.32; the original camera path is unchanged after that point.

## 26. Restore rear-board visibility and use Comet

- **Request:** the switchboard back was missing; compare the supplied GitHub code. Use Comet for browser access.
- **Cause:** the adapter hid the original board group while reconstructing each frame. The source update restored visibility only when cached `fade` changed; constant fade 1 left the board hidden.
- **Fix:** restore `group.visible` on every board update, independently of material-fade caching. Added `boardVisible` diagnostics and an assertion in the room regression script.
- **Validation limit:** production build passed. Earlier desktop/portrait room tests passed alignment, lighting and cable opacity/identity but missed geometry visibility. The new assertion has not completed a successful post-fix run. Comet inspection timed out; final rear-board visual confirmation remains open.
- **Delivery:** implementation committed and pushed as `6d33386` to `origin/bishwa-wire-v1`. Browser screenshots under `.taste-skill/` are ignored. This subsequent Markdown refresh is local until committed/pushed separately.
- **Current handoff:** [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md) is the starting point for further work. The original decision 23 remains historical; only one red connection wire is current, and decision 25 governs camera movement.

## 27. Integrated Biosciences hero frame and header (2026-11-04)

- **Request:** implement the hero as in the Integrated Biosciences reference (screenshot supplied; study in [INTEGRATEDBIO-DESIGN-STUDY.md](INTEGRATEDBIO-DESIGN-STUDY.md)): the whole city inside a frame with the text in the same composition, the navbar in that style, and the frame growing to a full section on scroll, as the earlier framed opening did. **Keep Tamira's typefaces** (Geist Serif, Instrument Sans); no font change.
- **Done:** the sticky stage is clipped to a rounded inset frame (12px/20px desktop, 8px/20px below 1024px) that opens to zero over `rise` 0–0.35. A daylight sky gradient sits behind the transparent city render and fades into the page colour over `rise` 0.55–0.95, before `wireOn`. Headline top-left (50–112px, line-height 1, −0.03em), sentence bottom-left, action bottom-right, on one centred 1524px container (`--hero-x`), which now also sets `--content-x` for the header, chapters, gauge and Contact. The header has the wordmark alone at the left and a frosted nav panel with a dark Contact action at the right; on smaller screens it is one frosted bar with a dark Menu toggle. A two-part slanted button (dark label, Tamira red arrow block in place of the reference's lime) replaces the red pill. The load reveal uses the reference timings.
- **Adaptations:** the reference's mono uppercase controls are set in Instrument Sans uppercase, not a new face. The headline stays black on the light sky rather than white over dark video. A sky-coloured haze sits behind the sentence because the sharp clay edges cut through it.
- **Unchanged:** camera path, city framing, rise, wireframe handover, product chapters, finale and room. The copy lift now applies to the headline/haze/sentence row individually, so the sentence stays above the city canvas.
- **Validation:** `vite build` passed. Desktop 1440×900, phone 390×844, the open menu, rise 0.15/0.9, wireOn, copper, room and reduced-motion states were inspected in headless Chrome screenshots via agent-browser. **Not a Comet review:** Comet exposes no CDP endpoint and screen capture permission is off in this session. Comet visual sign-off and hover states remain open.

## 28. One wire look across the city-to-product hand-over (2026-11-04)

- **Request:** the wire's lighting changed during the transition into the copper chapter (Comet screenshots supplied); keep it the same.
- **Cause:** at the end of `drain` the wire on screen is still the city copy, drawn in the city renderer. Its environment rotation was set from the city→product matrix, but three.js negates the Euler angles when building the shader lookup, so the room environment was upside down on that copy: city up looked up the product floor, and the jacket was lit from below. Two further differences: the strands still had full ember glow (flat peach), and the city tail ran flat down onto the avenue (an S-bend, sparser segments) instead of the product wire's straight tail.
- **Fix (`src/story/scene.js`):** set the environment rotation to the negated Euler, so the city lookup equals the product's (checked numerically against three's conversion). Over `drain` 0.3–0.95, after the city has faded at 0.28, the city wire's tail blends onto exactly the product path (entry shape with the CatmullRom end ghost point), its tail length becomes the product's (entry length + 30), and the strand glow cools to 0. The product wire no longer adds glow of its own. Lights, tone mapping, environment intensity and camera were already identical.
- **Unchanged:** camera choreography, the city run and approach, and every chapter after the hand-over.
- **Validation:** `vite build` passed. Headless Chrome (agent-browser) screenshots at 1440×900 of `drain` 1 and `wireIn` 0.7 now match by eye, and `run` 0.8 and `drain` 0.6 were checked. Not a Comet review.

## 29. Three wires at the switchboard (2026-11-04)

- **Request:** after the less-smoke chapter, when the connection to the back of the switchboard starts, show three cables instead of one. This supersedes decision 24's single-wire count.
- **Done (`src/story/finale-stage.js`):** the red product wire is unchanged: same instance, continuous from smoke, seated in L with no fade. Black and green are two more `Wire` instances (`src/story/wire.js` now takes `ink` and `envMapIntensity` options) at the red wire's finale scale on the source N/E rails. They use the source colours, legend ink and sheen (black 0.5, green 0.65), timing (finBlack 6.46–6.58, finGreen 6.54–6.66, cubic seat, 26-unit travel, 30-unit visible length) and screw clicks (6.58–6.61, 6.66–6.69). They are hidden until they move and hidden again whenever the finale stage is (scrolling back into smoke). Their materials are compiled when the stage is built during smoke. Camera, board, room and the decision 25 timing are unchanged.
- **Validation:** `vite build` passed. `scripts/verify-room-finale.mjs` now expects 1/2/3 connection wires across the sequence, and it passed (wire counts, board visibility, red cable identity and opacity, handoff error 0.004px, lighting steps 7). Visual frames at finale 0.30/0.45/0.53/0.66/0.92 were reviewed **in Comet** (automated separate instance via agent-browser `--executable-path`, Comet's Chromium 156, headless, 1440×900): red then black then green seat with click rings, and the front view shows no cables. Reverse scroll to smoke shows only the red wire.

## 30. Rebuild the room with realistic materials (2026-11-04)

- **Request:** refine the final room design with realistic textures and materials, rendered on the Windows team machine through the team Blender connection, on the GPU.
- **Done:** the room has no source scene, so it was rebuilt in Blender 5.2 (`art/blender/build_room.py`) with the same layout, measured from the original renders through `room.json`. Materials: oak laminate floor, oak veneer furniture and frame, tinted painted plaster, linen upholstery, herringbone wool rug, waffle-cotton throw, translucent sheers, thin window glass, real plants, and a dusk sky with a tree outside. All are CC0 Poly Haven (see REFERENCES-AND-ASSETS). Cycles lighting is 3000 K, AgX, exposure +1.05. The 48 frames keep the original cameras, crops, sizes, file names, five cumulative lighting steps, rocker flips and the painter's soft-edge profile. Board alignment within 0.08 px at every level; regression script board error 0.006/0.004 px with 7 lighting checks passing.
- **Team machine:** rendered as a separate background `blender.exe` writing only under `tamira-reference-match`; the teammate's open Blender was not modified. The GPU was saturated by Unreal Editor; at the user's request its unsaved level was saved as `/Game/Untitled_backup_2026_11_04` and Unreal was closed normally (it relaunched on its own afterwards, idle). The final run took 31 minutes on the RTX 3060 (OptiX).
- **Format:** still the image route (48 pre-rendered frames painted on Canvas2D), with no code changes. A live GLB room is the agreed follow-up, to be built and compared side by side before any switch.
- **Weight:** 2.7 MB for the 48 WebPs (was 1.9 MB). The originals remain in git history.
- **Validation:** viewed in Comet (separate muted instance): the 3D board hand-off, pull-back and fully lit room at 1440×900. Portrait viewed in renders only.

## 31. Live GLB room: lab prototype (2026-11-04)

- **Request:** start the GLB version of the room, uncompressed, "immersive and top notch quality". The user chose a *visually lossless* budget over a literal 170 MB uncompressed export.
- **Done:** `art/blender/export_room_glb.py` exports the same Blender room (built on the Mac from `build_room.py`, since multi-MB binaries can't cross the team-Blender link) to `public/room-3d/`:
  - `room.glb`: 13 MB, 336K triangles, no Draco, no decimation.
  - 2K tinted texture sets: colour JPEG q95, normal/roughness WebP q95, all on world-scale UVs.
  - The outside tree (1.07M triangles, seen only through the window) is a 2K Cycles-rendered cut-out.
  - `room-lights.json` (17 lights in 5 groups, emissive materials, texture sizes) and the 2K dusk HDRI. About 45 MB in total.
- **Lab page:** `room-lab.html` (dev only; the story still uses the 48 images).
  - Cycles-equivalent light units, AgX, soft spot shadows, GTAO, sheen on fabrics, dusk HDRI outside.
  - Lighting steps with rocker flips, pull-back slider using the painter's own window maths, image overlay for comparison, and free-look orbit.
  - Verified in Comet (muted): the overlay lines up exactly with the rendered frames; about 45 fps on an M3 at 1440×900.
- **Open:** no global illumination yet; a warm fill stands in for bounce. Next is Cycles-baked lightmaps per lighting group, summed by step in the shader, for render-matching bounce light. After that, story integration (board hand-off into the live room) and phone performance. `public/room-3d` ships in `dist` although the story doesn't load it yet.

## 32. Live GLB room in the story behind ?room=glb (2026-11-04)

- **Request:** wire the GLB room into the story behind `?room=glb`.
- **Done:**
  - `src/story/room-glb.js` holds the shared live room: GLB load, materials with Cycles normal strengths, Cycles-unit lights, AgX, shadows, GTAO, the camera from room.json through the painter's `windowAt`/`tanRect`. Each of the five lighting groups takes a 0–1 level, so lights and glow fade in and each rocker tips over with its light.
  - `src/story/room-live.js` has the same interface as `createRoom()`. It lazy-loads Three.js and the GLB near the end of smoke, stays hidden until ready (never covers the live board with an empty canvas), fades in over 6.99–7.06, follows `ROOM_BEATS` for the pull-back and steps, and keeps the dark close. It re-renders only when something changes.
  - `main.js` picks it when the URL has `?room=glb`; the images stay the default. The lab page now uses the shared module.
- **Validation:** `vite build` passed; the room code is a separate lazy chunk. `verify-room-finale.mjs` (default image mode) passed: board error 0.006/0.004 px, 7 lighting checks. In Comet (muted), `?room=glb` at 1440×900: the board hand-off matches (finale 0.97 → room 0.03), the step-2 close-up has two rockers on, and the full room sits under the copy.
- **Open:**
  - A third WebGL context on the page.
  - No baked bounce light yet (the warm fill stands in).
  - Phones and reverse-scroll not yet checked in GLB mode.
  - If the GLB fails to load, the room stays hidden; there's no image fallback.

## 33. GLB room by default on desktop, Cycles-baked lightmaps (2026-11-05)

- **Requests:** bake the room lightmaps on the Windows GPU; phones keep the image sequence for performance; "implement all this in the main localhost server link"; close Unreal on the team machine.
- **Default:** desktop-class screens now get the live GLB room in the story. Phones and tablets (coarse pointer, short side under 900 px) always get the 48 images. `?room=images` forces the images on desktop.
- **Bake:**
  - `export_room_glb.py … lm` adds a shared lightmap UV atlas (TEXCOORD_1, 19 static meshes) and saves `web.blend`.
  - `bake_room_lightmaps.py` bakes six 2048² HDR maps in Cycles on the RTX 3060, 1024 samples, in 24.5 minutes: the dusk sky (direct + indirect) and each light group's indirect light.
  - GLB and maps came over as packed data images (`art/tools/data_png.py`, SHA-256 verified), were denoised with OIDN on the Mac (pixel noise −61%, energy unchanged), and were encoded as RGBM WebP (round-trip error 0.1–0.2%). That's 19 MB of maps; `public/room-3d` totals about 64 MB.
- **Shader:** the six maps are summed, each weighted by its group's level. It stays within WebGL's 16 textures per shader: the dusk map is the material's own `lightMap`, and only the pendant and arc lamp cast live shadows.
- **Calibration** (Comet, 1440×900, scene brightness against the renders):
  - The environment map was adding unoccluded diffuse light, so it's now reflections on glossy unbaked parts only.
  - Bake scale 1/π; per-group scales `[0.42, 0.15, 0.17, 0.17, 0.17]`.
  - Neutral tone mapping at +0.4 stops; three's AgX washed out the 3000 K warmth.
  - Result: dusk 0.113 against 0.105, step 1 0.223 against 0.250, step 5 0.334 against 0.341; red-to-blue 2.9–3.3 against 3.2–3.3.
- **Team machine:** Unreal Editor was closed with a normal close at the user's request. The team watchdog (`C:\blender-mcp\watchdog.ps1`, scheduled task) restarts it within seconds, so it can't stay closed without changing that task; I left the watchdog alone. The bake ran on the GPU while Unreal sat idle.
- **Validation:** `vite build` passed; no shader errors. `verify-room-finale.mjs` now runs against `?room=images` and passed (0.006/0.004 px, 7 lighting checks). In Comet (muted), the main page in GLB mode showed the board hand-off, the close-up and the full room.
- **Open:** phone check of the image fallback after this change; GLB-mode reverse scroll; no image fallback if the GLB fails to load; GPU memory with three WebGL contexts on lower-end desktops.

## 34. Image room on desktop again (2026-11-05)

- **Request:** use the image sequence on desktop as well; the GLB room was breaking.
- **Done:** `main.js` uses the 48 rendered images everywhere. `?room=glb` still opens the live GLB room on desktop as a development switch (phones never). The GLB code and `public/room-3d` stay in the repo, but the default page doesn't load them. `verify-room-finale.mjs` is back on the plain URL.
- **Validation:** `vite build` passed; the regression passed (0.006/0.004 px, 7 lighting checks). In Comet (muted) at 1440×900, the room diagnostics report the image painter and the fully lit room renders.
- **Open:** the cause of the user-reported GLB breakage isn't diagnosed yet.

## 35. Blendkit cable material tried and reverted (2026-11-05)

The supplied bundled-cable material was applied, then rejected by the user and fully removed. Keep the original smooth red jacket and printing. The source `.blend` stays local as an unused reference.

## 36. Replace only the hero story with the supplied skyline sequence (2026-11-05)

- User requested the shared new site's hero story through its tower room and ceiling-wire follow, then the existing site's single-wire story unchanged. Keep current fonts and layouts.
- Adapted the supplied `Wire website/temira` GLB, scan/LiDAR, underground network, tower climb, room and ceiling-wire camera path to vanilla Three.js in `src/story/skyline/`. No React UI, loader/rail, typography migration or three-core product was imported.
- Added a red-wire/path/camera bridge into the current product entry, using matched lighting and environment. Existing copper-through-final-room choreography is preserved. The old city/avenue opener is inactive; its source/assets remain.
- Existing frame/header/headline/sentence/action layout and fonts remain. New first-paint/static posters show the skyline. Two existing renderers are reused, and versions stay pinned.
- Build and muted Comet desktop/portrait integration checks passed; finale regression preserves board visibility, cable identity/opacity, counts, alignment, lighting, reverse and reduced motion. No physical-device profiling is claimed.
- Details and review links: [SKYLINE-HERO.md](SKYLINE-HERO.md).

## 37. Three-core reveal and continuous red-core extraction (2026-11-05)

- User supplied a screenshot of the three-core construction scene and requested red, blue and green wires, followed by the red wire pulling out into the existing single-core story instead of a direct match cut. Current fonts/layouts remain.
- Added a 3-screen `bundle` segment after the ceiling follow: white outer sheath, translucent bedding, three independently insulated cores and four host-styled construction callouts. The source's brown and striped green cores are replaced with the requested red and plain green. Thirty copper strands use the current wire model.
- `drain` is now 2.6 screens. The assembly's red `Wire` instance pulls forward while blue/green hold still; the camera follows. Only afterward do the assembly/background recede and the red path normalize into the existing entry. The final product frame remains matched, and all later product/finale choreography is retained. Total story is 32.05 screens.
- Installed the user's 29 Emil skills into `~/.codex/skills` (28 new, one replaced with backup). Used `emil-animations` guidance for state continuity, paired easing, reversal, existing stack and reduced motion.
- Build and desktop/portrait 30-frame integration checks passed in muted Comet, including core count, red identity/movement, stationary other cores, callout bounds/non-overlap, reverse seeks, unchanged fonts and reduced-motion rebuild. Updated finale regression is run separately.

## 38. Hero sentence under the headline, haze removed (2026-11-05)

- The user asked to remove the white cloud behind the hero sentence and move the sentence under the main title.
- `.hero__haze` is gone. `.hero__lede` now follows the `h1` inside `.hero__head` (top-left), and `.hero__aside` holds only "Talk to us" (bottom-right from 1025px, bottom-left below). The scroll lift applies to the headline, sentence and action separately; the wrapper gets no z-index or opacity, so the tower still layers in front of the headline and the sentence stays above the city canvas.
- Checked in muted Comet at 1440×900, 1024×768 and 390×844.

## 39. Lenis smooth scroll (2026-11-05)

- The user asked for Lenis smooth scrolling. `lenis` 1.3.27 is pinned. It is created in `runStory()` with `autoRaf: false`, driven by `gsap.ticker` (`lagSmoothing(0)`), and calls `ScrollTrigger.update` on every Lenis scroll. Wheel and trackpad input is smoothed (`lerp` 0.1). Touch keeps native momentum (no `syncTouch`). In-page anchors (`anchors: true`) glide. Reduced motion never runs `runStory()`, so it keeps native scrolling. The cleanup destroys Lenis and restores the ticker's lag smoothing.
- The master timeline's `scrub` went from 0.6 to 0.3, because Lenis already smooths the input and the two together felt floaty. The dev `?at=` jump uses `lenis.scrollTo(..., { immediate: true })`.
- Checked in muted Comet: wheel input eases (scrollY 1604 → 2054 → 2400), the 3D story follows, "Talk to us" glides to the contact section, and there are no console errors. `verify-skyline.mjs` passes at both sizes, including the reduced-motion teardown and rebuild.

## 40. X-ray shows only the wired district (2026-11-05)

- The user asked to remove the background buildings in the wireframe/hairline mode and keep the main ones. The outer-city filler (`filler.js`) no longer draws box outlines. Its solid blocks were already dissolved by the x-ray shader, so the scan now shows only the hero tower and the 36 modelled district buildings that the underground network feeds. In daylight the filler is unchanged. `lidar.js` `boxEdges` is now unused and kept for reference.
- Checked in muted Comet at 1440×900: wireOn 0.5/1, extend 1, run 0.3. `verify-skyline.mjs` passes.

## 41. Loader: one red core runs in with the real progress (2026-11-05)

- The user asked for a loading screen in the site's design language (checked with taste-skill). The idea: the red Tamira core is the progress bar. It runs in from the left edge at mid-height, its stripped copper tip marking the real progress; at 100% the strands touch the right edge, then run off. The count (Geist Serif, `clamp(4.5rem, 2rem + 12vw, 14rem)`, tabular figures) sits bottom-right; "Running power through the city" (hero sentence size) sits bottom-left. White ground, black ink, flat red insulation in three tones (no gradient or shadow), copper drawn as an SVG strand bundle. The header stays on top, so the wordmark never moves; its nav fades in with the hero intro. The panel then lifts away (800 ms, ease-out-quint) and the existing intro plays.
- The progress is real and weighted: fonts 10%, hero poster 10%, the 3D chunk 10%, `city-v2.glb` bytes 60% (Vercel serves it brotli-compressed with no length, so it falls back to the decoded 5,520,344 bytes) and the first render 10%. It is shown for at least 0.9 s and holds at 99 until done; after 15 s it finishes anyway. With the loader up, the 3D now starts at once instead of at idle. Lenis and page scroll are stopped while it shows.
- Fallbacks: without script it never shows (`html.is-loading` is set by an inline head script). Under reduced motion it finishes on fonts + poster and fades out with no travel. A failed 3D load goes static and finishes the same way. Dev only: `?loaderhold=0.64` holds it for review.
- Files: `src/loader.js`, the `.loader` block in `index.html` and `style.css`, progress getters in `skyline/index.js` and `scene.js`, wiring in `main.js`.
- Checked in muted Comet at 1440×900, 768×1024 and 390×844 (held at 64%, 99%, 20%), the live sequence (45 → 99 → 100 → lift → hero) and reduced motion. `verify-skyline.mjs` passes. taste-skill `lint.mjs` on `src/loader.js` has 0 FAIL / 0 WARN. The site-wide lint flags only the existing sky gradient, frosted header and button shadows, which are left as they are.
- Found while checking (it predates the loader, not fixed): in the reduced-motion static page the opaque `poster-desktop.jpg` covers the hero headline (`.hero__title` z-index 1 sits under `.hero__opening`).
- **Slowed 2026-11-05 (the user found it fast):**
  - The shown value now eases at a frame-rate-independent rate (3.2/s) with a speed limit of 55% of the screen per second, so a cached load still glides.
  - It is shown for at least 2.2 s and holds 350 ms at 100%.
  - The tip runs off over 900 ms (ease in-out). The lift starts as the copper clears the edge and runs for 1.3 s (ease in-out).
  - The hero intro is slower too: lines 1.15 s with a 0.09 s stagger, the sentence at 0.12 s, the action at 0.5 s with a softer settle, the nav from 0.1 s.
  - A local reload measures: 16% at 0.45 s, 99% at 2.65 s, 100% at 2.9 s, lift at ~3.9 s, gone at ~5.2 s.

## 42. Hero reveal after the loader (2026-11-05)

- The user asked for reveal animations once the loader uncovers the hero. Before this, the intro played as the panel started lifting, mostly hidden under it. Now `loader.onRevealed` fires 55% into the lift, once the headline is uncovered, and the reveal plays in view.
- `splitWords()` (main.js) wraps the headline's and sentence's words in `<span class="word">`, with the spaces kept as text. Then:
  - headline words rise 115% out of their line masks (1.25 s, power4.out, 0.07 s apart);
  - sentence words drift up 14 px and fade (0.9 s, 0.018 s apart, from 0.45 s);
  - the nav panel settles down 12 px (from 0.15 s), then its links arrive left to right with Contact us last (0.06 s apart); on phones, the Menu button instead;
  - "Talk to us" settles in from 0.85 s;
  - the poster fades over 1.6 s.
- Transform and opacity only. Reduced motion never runs it (static page).
- Checked in muted Comet at 1440×900 and 390×844 (the phone menu stays closed). `verify-skyline.mjs` passes.
- **Sped up the same day (the user asked for it a bit faster):** the reveal starts 45% into the lift.
  - Headline words: 0.85 s, 0.045 s apart.
  - Sentence words: 0.65 s, 0.012 s apart, from 0.28 s.
  - Nav panel: 0.6 s from 0.3 s, so it doesn't show over the loader's count; links 0.5 s, 0.04 s apart, from 0.4 s.
  - "Talk to us": 0.65 s from 0.55 s.
  - Poster: 1.1 s.
  - The whole reveal now finishes in about 1.2 s.
