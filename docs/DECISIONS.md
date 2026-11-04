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

## Rejected or replaced along the way
- The "wave" transition (client, before this repo).
- A matched-frame Blender camera dive into a wall as the city → wire hand-over. It was replaced by the live-3D hand-over.
- A dark studio background for the wire chapters (as in the reference). The chapters are on a light lavender page, per the storyboard.
- Centred chapter copy (as in the reference). We keep copy in the left column.
- A multi-core cable (as in the storyboard). The product is single-core house wire.
- The street-level "train ride" camera shot.
- The day → night video and the night city.
