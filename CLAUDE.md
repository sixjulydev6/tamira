> **Current finale (decision 23):** the single-switch ending is superseded by the original rear three-wire switchboard, camera arc, matched rendered-room pullback and five lighting groups. Read `docs/ROOM-FINALE.md`. `finale` is 4 screens; `room` is 3. Original room assets were explicitly selected by the user.

> **Latest runtime (decision 22):** the full daylight city, traffic and camera rise now run in Three.js (`src/story/daylight.js`), sharing the existing city renderer. A labeled GSAP timeline drives the story; GSAP matchMedia owns reduced-motion teardown/rebuild. There is no rise-frame or traffic-video playback. See `docs/LIVE-3D.md`; older descriptions of raster rise playback below are superseded.

# Tamira website

Marketing site for **Tamira**, a wiring and cable company. Headline: "Good wiring is the kind you never think about." The homepage is one scroll-driven story: the day city hero turns into a glowing wireframe network on the first scroll; a single-core red house wire runs along an avenue, lighting the street lights and buildings as it passes; the camera pushes in, the city drains into the wire's tip, and the same wire then tells the product story on a light page. The flow follows the Sixjuly concept at wirecable-showcase.vercel.app. The other site sections (Consumers, Industries, Investors, Company) come later.

## Docs

This file is the compact working brief. The full context lives in:
- [README.md](README.md): overview, run, stack.
- [docs/STORY.md](docs/STORY.md): the scroll story beat by beat, segment lengths, tuning knobs, `?at=` review links.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): code structure, the two-renderer pipeline, the city ↔ product hand-over mapping M, colour-management gotchas, how to add or change things.
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md): grid, type, colour, composition and motion rules.
- [docs/DECISIONS.md](docs/DECISIONS.md): client direction and decisions in order, including rejected options. **Read it before changing direction.**
- [docs/REFERENCES-AND-ASSETS.md](docs/REFERENCES-AND-ASSETS.md): references, media, the Blender source project, shared render machine rules.
- [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md): placeholders, open client questions, known issues, launch checklist.

When something changes, update the matching doc (and add an entry to DECISIONS.md for any client-driven change).

## Run

```bash
npm install
npm run dev       # Vite on http://localhost:5180 (use --port 5180 --strictPort if the default differs)
npm run build     # → dist/
npm run preview
```

Dev only: `?at=<segment>:<t>` jumps to a moment in the story, for example `http://localhost:5180/?at=heat:0.6`. Segment ids are in `src/story/timeline.js`.

Stack: plain HTML/CSS/JS with **Vite 5.4.10**, **GSAP 3.12.5** (+ ScrollTrigger) and **Three.js 0.170.0**. No framework. Versions are pinned exactly in `package.json`; keep them pinned. Three.js and the story scene are a separate chunk, lazy-loaded after first paint (`import("./story/scene.js")`), so the hero never waits for it.

## Files

```
index.html             header, nav, the story stage (day image, canvases, copy, labels, gauge), end section
src/style.css          all styles; design tokens at the top in :root
src/main.js            menu, page-load reveal, the master scroll timeline, page colour, copy/labels/gauge
src/story/
  timeline.js          SEGMENTS (id + length in screens), local(p, id) and easing helpers
  palette.js           page colour and ink through the story (white → warm night → lavender → chapter tints)
  chapters.js          chapter copy, pinned labels, gauge values (placeholder specs, see below)
  scene.js             renderer, city camera (extend, approach, drain), wire choreography per chapter, label anchors
  city.js              wireframe city ported from hero_day.py (buildings, crown, streets, line shaders)
  wire.js              the procedural wire: jacket with printed legend, 30 copper strands, cutaway/heat/char
  props.js             conduit elbow, heater, flame, smoke, wall plate (procedural; swappable for GLBs)
public/media/
  hero-city-{3840,2560,1920}.{avif,webp,jpg}   the day render (16:9): the hero image / video poster, served via <picture>
  hero-traffic-2560.{webm,mp4}                 the traffic loop over it (AV1 / H.264), frame 0 = the poster
  hero-day.jpg, hero-day-night*.mp4, hero-night.jpg   no longer used (old hero, removed day→night scrub); safe to delete
public/favicon.svg  placeholder
art/                the hero's source: build_city.py (Blender), layout manifest, masters, checks (see art/README.md)
```

## The story: how it works

- One `.story` section, `(TOTAL_SCREENS + 1) × 100svh` tall, with a sticky 100svh `.story__stage`. One ScrollTrigger (`scrub: 0.6`) drives a single progress `p` (0–1). Everything (page colour, 3D camera and shaders, copy, labels, gauge) is a pure function of `p`, so scrolling back reverses everything exactly. There is no time-based motion in the story (the hero traffic loop is a fixed backdrop, not story motion).
- Segments and their scroll length (screens) live in `timeline.js`: `day 0.35 · open 1.2 · wireOn 1.2 · extend 1.4 · run 2.2 · approach 1.4 · drain 1.0 · wireIn 0.9 · copper 1.5 · strands 1.7 · flex 1.7 · heat 1.9 · flame 1.7 · smoke 1.3 · finale 1.7`. Retune pacing there.
- Composition rule: copy on the left column, the visual on the right; chapter copy is upper-left (title / body / spec line). It never centres over the object. **One exception:** the hero copy is centred above the framed city (the page's one centred moment, never over the city).
- Layers in the stage (bottom → top): day image (`.hero__stage`), city canvas, product-wire canvas, hero headline, chapter copy, labels, gauge.

### 1. Day hero → wireframe
- Layout: the Tamira logo left with the nav grouped beside it (Consumers, Industries, Investors, Company); **Contact us** is an outlined red button on the far right (grid and type from arrakis.tech, see "Grid and type"). Full bleed: a street-level shot of the clay city with the orange crown tower centred, rising **in front of** the centred two-line headline (client reference, DECISIONS 20); sentence + "Talk to us" in the left column over the sky. On the first scroll (`rise`) the copy lifts away and the camera rises to the isometric view: 72 pre-rendered frames (`/media/rise/`, from `animate_city.py` job `rise`) scrubbed onto `.hero__seq`; the last frame is the isometric camera, where `.hero__iso` (day render + traffic loop) takes over, then the wireframe story starts as before. Layering: `.hero__iso` < `.hero__title` (z 1) < `.hero__rise` (z 2) < `.hero__aside` (z 3); `.hero__stage` must not become a stacking context. No CSS masks; the shaders' mask copy (`uMaskMix`) is off.
- The isometric layer is the day render (`hero-city-*`, a satin-ceramic Cycles still from `art/blender/build_city.py`) with a 10 s traffic loop over it (`hero-traffic-2560.{webm,mp4}`, `.hero__video`, from `art/blender/animate_city.py`): same camera, cars only, frame 0 = the poster = the rise's last frame; `main.js` `setTraffic` plays it only while `rise >= 1 && wireOn < 1`. There is no night stage: on the first scroll (`wireOn`) the page goes white → warm night (`#140b07`), the city canvas fades in over the image and the orange lines climb the same buildings. The glow (bloom) and the white headline only come in once the page is dark, so there's no washed-out middle state.

### 2. Wireframe night, extended city, approach, drain (live 3D, `city.js` + `scene.js`)
- The wireframe city is a JS port of `hero_day.py` (same BUILDINGS table, `ground_at`, crown, roads and the `wf` linework), recoloured crown-orange on a warm night (client: match the hero's warm theme, DECISIONS 17). Keep it in sync if the Blender layout changes.
- **Exact hand-off:** at the start of the wireframe the 3D camera reproduces the Blender ortho camera (38° elevation, −45° azimuth, 400 m frame width) with a 0.5° lens from ~46 km, and `setViewOffset` maps it onto the day image's on-screen `object-fit: cover` frame inside `.hero__stage`. The shaders apply the same mask as the CSS. So the lines land on the render's edges while the image crossfades out (`wireOn`).
- **Extend:** the camera pulls back (400 m → 780 m frame) and a generated, deterministic outer city grows in around the original (`ext` lines and instanced hulls, kept off the avenue and low on its camera side). The avenue runs along world Y at x = 228 m (`AVENUE` in `city.js`), the building-free strip in front of the original city; on screen it's the lower-left → upper-right diagonal, like the train in the client's reference. It's lined both sides with street-light poles.
- **Run:** the red wire (the same `Wire` model as the product, scaled to a 2.2 m jacket radius) travels along the avenue at ground level, with no bridge. Each street light switches on with a warm glow and a pool of light on the street as the wire's tip passes it (`uHead` = tip's Y). The buildings power up too: a front (`uPower`) sits exactly at the tip while the wire runs and spreads sideways from the avenue, so nothing ever lights ahead of the wire. Once the wire stops, the front keeps spreading through the approach so the whole city is lit as the camera moves in. Street lights are every 36 m on both sides. Lit buildings keep their outline and fill their facades with warm windows (only the windows light), each switching on at its own moment (`powerLit` / `windowsOn` / `litFacade` in `city.js`). The headline lifts away at the start of the run. The city wire is drawn after the bloom pass so it stays crisp.
- **Approach:** one continuous push-in from the wide diagonal view to a close side view of the wire's tip. Because the wire already runs lower-left → upper-right in the wide view, the camera only eases ~45° round and levels off (angle and lens lag the distance slightly). It never goes behind or above the wire; that street-level "train" shot was removed. The tip lifts into its final shape over the second half. Extended blocks are kept off the patch on the avenue's near side that the camera crosses (`approachPath` in `city.js`), because the city wire is drawn on top of the city.
- **Drain:** the network drains into the wire's tip (screen-space radius around the tip's projected position, with a bright leading edge) while the camera settles on the hand-over frame. It is fast: "approach" ends on the close diagonal frame (tip still on the street, city lit), and from there the city is gone within the first quarter of the drain and the page is fully lavender by ~40%; the tip lifts and the camera settles on the clean background (`approachK` in `scene.js`, `toLight` in `palette.js`). The page fades warm night → lavender (`--wire-bg #e4e4ee`); bloom is switched down on the way.
- **Hand-over (`wireIn`):** the drain ends on the product wire's opening frame mapped into the city by `toCity` (M: product x → city +Y, y → +Z, z → +X, ×2.2). The city wire's lifted path, camera, lights and environment rotation all go through M, so the two renders are the same picture, and the product canvas (`.story__canvas--wire`) crossfades in over it. Keep `SHAPES.entry`, `CITY_SCALE`, `HEAD_Y` and the lights consistent or the seam shows.
- Bloom (UnrealBloom) is used for the city only. A full-screen backdrop quad in the page colour keeps the sky, hulls and ground identical to the page background (the canvas clear colour alone did not survive the post chain).

### 3. The wire (live 3D, `wire.js` + `props.js`)
- Single-core red HR-FR-LSH house wire, jacket radius 1. It follows a CatmullRom path. Path shapes (`entry`, `elbow`, `wave`, `finale`) are defined in normalised screen space in `scene.js` and morph per chapter. The geometry is rebuilt on the CPU onto the path when the scroll moves (parallel-transport frames, binormal toward camera so the printed legend faces us).
- It is the wire that ran through the city: it arrives already in place, its copper strands still glowing ember-orange, then cooling to copper. Strand twist is measured from the tip so the city and product wires match exactly.
- Chapters: copper (strands fan out, camera close on the tip) · strands (front half of the jacket cut away, three labels pinned to 3D points) · flex (path bends into a clear conduit elbow) · heat (heater block, orange glow along the jacket, 25 → 85°C gauge with 70°C ordinary / 85°C Tamira marks) · flame (flame on the jacket, char mark, flame dies) · smoke (thin wisps) · finale (wire runs into a wall switch plate, rocker flips, LED goes green).
- Lighting: RoomEnvironment + key/rim lights, Neutral tone mapping, rendered straight to the canvas (no bloom) so the light background matches the page exactly.

### Fallback
- Reduced motion, or no WebGL: `.story.is-static`. No scroll story; the day poster shows, and the chapter copy is laid out as plain sections.
- Page load: one GSAP timeline (header fades in, headline lines rise with 0.1s stagger, stage fades in). The only other time-based motion is the hero traffic loop (client request, DECISIONS 15); don't add more unless asked.

## Grid and type (adapted from arrakis.tech)

Measured with REA from the reference's shipped CSS and DOM. We use its layout, spacing and type metrics only; its fonts and imagery are not used.

- 4px spacing base (`--space`). One centred container: 84rem of content, side padding 20px, 48px from 1024px up. `--page-x` is the padding that puts full-bleed blocks on that grid: use it as `padding-inline` instead of adding wrapper elements.
- Header: 64px tall (86px from 640px up), contents vertically centred. The logo (`public/tamira-logo.svg`) is 20px tall (~121px wide) in a 40px-tall link, 64px gap to the nav, 48px between nav items. Below 1024px the nav collapses into the menu.
- Hero copy is bottom-anchored: padding-top is the header height; padding-bottom is 40px, then 48px from 640px, then 96px from 1024px. Everything below the hero copy (chapter copy, gauge, Contact section) lines up with the framed city's side margin, `--content-x` (= `--hero-media-margin`, the same formula as `main.js` `layoutFrame`).
- Fluid type: each size runs linearly from a 480px to a 1280px viewport, then holds. Tokens are in `:root`: `--text-display` 36→56, `--text-heading-48` 28→48, `--text-heading-40` 26→40, `--text-body-20` 17→20, `--text-body-18` 16→18, `--text-body-15` 15, `--text-nav` 14→15. Later sections should use these.
- Leading: display 1.1, then 0.98 from 768px; headings 1.1, then 1.05 from 768px; body 1.5; body-20 1.3; nav 1.2. Tracking: headings −0.03em; 15px body +0.01em.
- The reference sets headings and body at weight 300. Instrument Sans has no 300, so we use 400.
- Buttons: 2px radius, padding 9px × 14px, nav type size.
- The reference caps its hero at 835px tall on desktop. We keep 100svh because the hero is pinned for the scroll scrub.

## Design tokens and rules

- Accent red `#ea3c32` (sampled from the reference; the logo carries its own coral `#F45E5E`). Headline ink pure `#000` in day.
- Type: **Geist Serif** (400, self-hosted from `public/fonts/`, `--font-serif`) for all headings; **Instrument Sans** (400/500) for UI and body. Instrument Sans comes from Google Fonts. These are stand-ins: the real logo file and brand font have not been supplied yet.
- Follow the skills used to build this: `frontend-design` (installed), and from the synced audit suite `web-animation-design`, `make-interfaces-feel-better`, `web-design-guidelines`. In practice: ease-out for entrances, ≤300ms for UI transitions, never `transition: all`, `text-wrap: balance` on headings, 40–44px minimum hit areas, visible focus (`outline` in accent red), and a `prefers-reduced-motion` path for every animation.
- Don't add generic template chrome (all-caps eyebrows, numbered markers, card grids, gradient washes) unless the brief asks for it.

## Placeholders and open items

- The logo is the client's SVG (`public/tamira-logo.svg`, source `asset/tamira-logo.svg`); nav links point to `#consumers` etc.; favicon is still a placeholder.
- **Specs in `chapters.js` are placeholders** carried over from the Sixjuly concept (typical HR-FR-LSH figures to IS 694). Replace them with Tamira's confirmed numbers before launch.
- The `.end` section (Contact) is a stand-in; its `mailto:hello@tamira.example` is a placeholder address. Later stages replace it with the rest of the site.
- Finale is a placeholder idea (wire into a switch plate). The client hasn't chosen between an interior room with lights coming on and returning to the city.
- Props are procedural. They can be swapped for Blender-made GLBs (meshopt/Draco, KTX2) without touching the timeline.
- Not yet done: real-device performance testing (phones especially), analytics, SEO/OG images, deployment.

## Where the visuals come from

**Current hero:** `art/blender/build_city.py` (in this repo) renders the clay/ceramic day city on the team machine; see `art/README.md` for render, encode and the alignment checks. It keeps `hero_day.py`'s layout and camera exactly, so `city.js` still lines up (`node art/tools/check-layout.mjs`).

Earlier hero imagery was rendered in Blender from one build script, with matching camera and layout across every style. Source project (outside this repo; on the team machine it is `C:\Users\india\Documents\tamira-reference-match\`, the Mac path below is not present on every machine):

```
~/Akhil/Tamira/tamira-reference-match/
  blender/hero_day.py                 builds and renders every style (pass a style switch)
  blender/day_to_night_compose.py     made the day → night video (no longer used on the site)
  blender/day_to_wireframe_compose.py day → orange glowing wireframe video
  blender/transition_compose.py       older "wave" transition (rejected by the client)
  renders/reference-match/            stills for every version + comparisons
  renders/animatic/                   transition videos
  references/                         the client's reference images
```

Style switches for `hero_day.py` (run: `blender -b --python hero_day.py -- <out_dir> <samples> <res%> <style>`):

| Switch | Look |
|---|---|
| `v1` | version 1: warm daylight, white city, orange crown tower (matches client Image 1) |
| `v1g` | version 1 + orange street-level glow on five big towers |
| `v1n` | night version of `v1g`: dark slate, warm lit windows, glows |
| `v1na` | `v1n` with every light off (compositing pass for the day → night video) |
| `v2` | cool white/ice-blue high-key style, no orange |
| `v3` | `v2` + orange glow rising from street level |
| `wf` | version 4: orange glowing wireframe with speed lines, glow and haze |
| `wfa` | `wf` with every line off (compositing pass) |

Camera for all styles: orthographic, 38° elevation, −45° plan azimuth, zero roll, 400 m frame width, 1920×1080.

### Rendering machine

Renders run on a shared "team Blender" (Windows, RTX 3060, Blender 5.2.2), reached through the `team-blender` MCP server. That machine is also used by other people:
- Never modify or save the Blender file open in the live session (a teammate's project). Run Tamira renders as a separate background process: `blender.exe -b --python <script>`, writing only under `C:\Users\india\Documents\tamira-reference-match\`.
- The GPU is often shared, so a render takes ~1 min when idle and 6–10 min when busy.
- Don't close other people's apps without explicit permission, and only with a normal (non-forced) close.

## History

Earlier explorations live in the source project above: a 32-second city → cable → Earth story prototype in Three.js (`tamira-reference-match/web/index.html`) and a single-shot lighting study (`web/shot02.html`). The client then narrowed the scope to this hero, so those are reference only.

The client's storyboard ("MacBook Air - 17.pdf") is mood and camera direction only: an isometric day city, a street-level cyan wireframe night, and a cable entering from the bottom-left on a light lavender page. The product is single-core household wire, focused on copper.
