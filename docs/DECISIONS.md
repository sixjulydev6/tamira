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

## Rejected or replaced along the way
- The "wave" transition (client, before this repo).
- A matched-frame Blender camera dive into a wall as the city → wire hand-over. It was replaced by the live-3D hand-over.
- A dark studio background for the wire chapters (as in the reference). The chapters are on a light lavender page, per the storyboard.
- Centred chapter copy (as in the reference). We keep copy in the left column.
- A multi-core cable (as in the storyboard). The product is single-core house wire.
- The street-level "train ride" camera shot.
- The day → night video and the night city.
- The cyan-on-navy wireframe (replaced by orange on a warm night, entry 17).
- The soft, foggy `hero_day.py` v1 finish (strong DOF, orange glow light). It was replaced by the clay / ceramic render (entry 12).
