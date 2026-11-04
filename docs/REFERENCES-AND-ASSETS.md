# References and assets

## Reference sites and material

| Reference | What we took from it | What we didn't |
|---|---|---|
| **arrakis.tech** | Grid, margins, header layout, text placement, type scale, weights, tracking, leading (measured with REA from its shipped CSS/DOM) | Fonts, imagery, all-caps mono labels |
| **wirecable-showcase.vercel.app** (Sixjuly concept, fictional Tamira brand) | Chapter order and copy, the idea of a scroll pacing table, procedural wire geometry | Its dark studio look, centred copy, coil/box opener, pre-rendered room finale, its specs (illustrative only) |
| **Storyboard "MacBook Air - 17.pdf"** (client) | Mood and camera direction: isometric day city → cyan wireframe night → light lavender page with a cable from the bottom-left | Literal frames; the multi-core cable it shows |
| **Isometric city stills with a train** (client, two images) | The extended-city idea and a diagonal track through the city; the wire replaces the train | The bridge/platform and the solid daylight style (our extended city is wireframe) |
| **Screen recordings and screenshots** (client feedback) | Frame-by-frame review that drove decisions 8 and 9 in [DECISIONS.md](DECISIONS.md) | — |

The client's original reference images are in the source project: `tamira-reference-match/references/`.

## Media in this repo

| File | Status |
|---|---|
| `public/media/hero-city-2560.*`, `hero-city-1920.*` (AVIF, WebP, JPG) | **Used.** The day render, 16:9, from `art/blender/build_city.py` (clay / satin-ceramic finish). It is the hero image, and the wireframe is aligned to it. |
| `public/media/hero-traffic-2560.webm`, `.mp4` | **Used.** The traffic loop over the hero (10 s, 24 fps, AV1 / H.264), from `art/blender/animate_city.py`. Frame 0 is the `hero-city-*` still. |
| `public/media/hero-day.jpg` | **Unused** since 2026-11-04 (replaced by `hero-city-*`, same layout and camera). A copy is kept in `art/review/baseline/hero-day-previous.jpg` for comparison. |
| `public/media/hero-day-night.mp4`, `hero-day-night-1280.mp4`, `hero-night.jpg` | **Unused** since the night stage was removed. They are still copied into `dist/` by the build; delete them before deploying unless needed. |
| `art/renders/`, `art/review/` | Hero master (3840×2160 PNG), review crops, baseline/after screenshots, alignment overlay. Not shipped. |
| `public/favicon.svg` | Placeholder |
| `assets/vids/*.mov` | Client screen recordings used for review. Not part of the site. |

## The current hero: `art/blender/build_city.py`

The clay / ceramic day city that ships now. It is a straight port of `hero_day.py`'s layout, crown and camera; only the finish differs. How to render, encode and check it: [art/README.md](../art/README.md). The brief it implements is `prompt.md` at the repo root.

**What changed from `hero_day.py` v1, and why:**

| Area | `hero_day.py` v1 | `build_city.py` | Why |
|---|---|---|---|
| Crown | six intersecting arm prisms | one solid: the arms' plan union with the hexagonal opening as a hole | the overlapping prisms showed black slivers at the arm junctions |
| Bevels | 3.5% of width, 4 segments, plain smooth shading | 2.2% (0.45–1.4 m), 5 segments, weighted (face-area) normals | continuous edge highlights, flat broad faces with no shading dents |
| Windows | flush squares | raised 0.14 m insets, lighter greys | they read as relief, not print, and stay subordinate |
| Materials | metal on roofs, coat on orange, cooler ground | all dielectric (metallic 0, coat 0), satin roughness 0.38–0.48 with a ±0.03 low-frequency drift; ground `#E8E9E7` | satin ceramic / coated clay, not plastic or chalk |
| Light | 10° sun at 42°, sky 0.34, orange point light at the crown base | 3° sun at 30° (one shadow direction, long raking shadows), neutral-cool sky 0.13, no orange point light | dramatic, directional shadows with crisp edges; orange spill comes from GI bounce, not an orange fog |
| Focus | strong ortho DOF (f/0.03) | off | the bevels carry the quality; blur hid them |
| Colour | AgX, look silently `None` (enum lookup bug) | AgX, Medium High Contrast, exposure 0 | chosen on purpose and recorded in the manifest |
| Streets | coplanar overlapping road boxes | stacked by 12 mm | coincident faces rendered black at crossings |
| Output | 1920×1080 PNG/JPG | 3840×2160 EXR (linear) + 16-bit PNG + JPG + crops + `city-layout.json` | Retina screens need up to ~3700 px; masters and a shared layout manifest |

**Review rounds** (team machine, `renders\clay\`):
1. `r01`: first look. Black patches at road crossings and crown junctions. The render had also fallen back to CPU (device lookup bug).
2. `r02`: crown rebuilt as one solid, roads stacked. Clean, but the 1% bevels were invisible at display size.
3. `r03` / `r04`: 2.2% bevels. `r04` also has more sky fill (0.38) and a softer key (6°), which suits the white page better.
4. `final`: `r04` with lighter window panes, 384 samples. Alignment check against the previous hero: best shift (0, 0) px. `check-layout.mjs`: 36 buildings agree within 0.5 mm.
5. `d1` / `d2` → `final2` (client: "shadows too light, more dramatic", and "should not pixelate"): lower sun (30°), 3° key, sky fill 0.13, AgX Medium High Contrast; master raised to 3840×2160 (DECISIONS 13).

The client's quality references (images 2–4 in the brief: dense orange-tower city, rounded-edge train scene, close material benchmark) were not available as files in this session. The finish was tuned from the brief's written analysis, so a side-by-side against those images is still to do.

## The Blender source project (outside this repo)

Earlier hero imagery was rendered in Blender 5.2 (Cycles) from one build script, with matching camera and layout across every style. On the team machine the project is `C:\Users\india\Documents\tamira-reference-match\` (it has `blender/hero_day.py`, `blender/build_city.py` and `renders/`); the `~/Akhil/...` path below is not present on every Mac.

```
~/Akhil/Tamira/tamira-reference-match/
  blender/hero_day.py                 builds and renders every style (pass a style switch)
  blender/day_to_night_compose.py     made the day → night video (no longer used on the site)
  blender/day_to_wireframe_compose.py day → orange glowing wireframe video
  blender/transition_compose.py       older "wave" transition (rejected by the client)
  renders/reference-match/            stills for every version + comparisons
  renders/animatic/                   transition videos
  references/                         the client's reference images
  web/                                earlier Three.js prototypes (reference only)
```

**Run:** `blender -b --python hero_day.py -- <out_dir> <samples> <res%> <style>`

| Style | Look |
|---|---|
| `v1` | warm daylight, white city, orange crown tower (**the hero image**) |
| `v1g` | `v1` + orange street-level glow on five big towers |
| `v1n` | night version of `v1g`: dark slate, warm lit windows, glows |
| `v1na` | `v1n` with every light off (compositing pass) |
| `v2` | cool white/ice-blue high-key, no orange |
| `v3` | `v2` + orange glow rising from street level |
| `wf` | orange glowing wireframe with speed lines, glow and haze |
| `wfa` | `wf` with every line off (compositing pass) |

**Camera for all styles:** orthographic, 38° elevation, −45° plan azimuth, zero roll, 400 m frame width, 1920×1080.

**Link to the website:** `src/story/city.js` is a port of this script's `BUILDINGS`, `ground_at`, crown, `ROAD_SEGS` and `wf` linework. If the Blender layout changes, port the change to `build_city.py` too and re-render `hero-city-*`, or the wireframe will no longer sit on the image.

## The shared rendering machine

Renders run on a shared "team Blender" machine (Windows, RTX 3060, Blender 5.2.2), reached through the `team-blender` MCP server. Other people use it too.

- **Never modify or save** the Blender file open in the live session; it's a teammate's project.
- **Run Tamira renders as a separate background process:** `blender.exe -b --python <script>`.
- **Write only under** `C:\Users\india\Documents\tamira-reference-match\`.
- **Expect wait times:** the GPU is often shared, so a render takes about 1 minute when idle and 6–10 minutes when busy. (`build_city.py` at 2560×1440 / 384 samples: about 40 s idle.)
- **Don't block the live session:** when driving it through the MCP, launch renders with `subprocess.Popen` (detached, below-normal priority) and never `sleep` inside it; don't load images into the live file either (use a separate `blender -b` process).
- **Don't close other people's apps** without explicit permission, and then only with a normal (non-forced) close.

## Tools used

- **REA** (reverse-engineer-anything): browser capture and CSS/DOM/JS-bundle analysis of the reference sites. Also used for every screenshot review of this site, including the `?at=` review frames.
- **Swift + AVFoundation:** frame extraction from the client's `.mov` recordings (ffmpeg isn't installed on the dev machine).
