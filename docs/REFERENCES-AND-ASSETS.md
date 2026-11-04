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
| `public/media/hero-day.jpg` | **Used.** The day render, 1920×1080, Blender style `v1`. It is the hero image, and the wireframe is aligned to it. |
| `public/media/hero-day-night.mp4`, `hero-day-night-1280.mp4`, `hero-night.jpg` | **Unused** since the night stage was removed. They are still copied into `dist/` by the build; delete them before deploying unless needed. |
| `public/favicon.svg` | Placeholder |
| `assets/vids/*.mov` | Client screen recordings used for review. Not part of the site. |

## The Blender source project (outside this repo)

All hero imagery was rendered in Blender 5.2 (Cycles) from one build script, with matching camera and layout across every style.

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

**Link to the website:** `src/story/city.js` is a port of this script's `BUILDINGS`, `ground_at`, crown, `ROAD_SEGS` and `wf` linework. If the Blender layout changes, port the change and re-render `hero-day.jpg`, or the wireframe will no longer sit on the image.

## The shared rendering machine

Renders run on a shared "team Blender" machine (Windows, RTX 3060, Blender 5.2.2), reached through the `team-blender` MCP server. Other people use it too.

- **Never modify or save** the Blender file open in the live session; it's a teammate's project.
- **Run Tamira renders as a separate background process:** `blender.exe -b --python <script>`.
- **Write only under** `C:\Users\india\Documents\tamira-reference-match\`.
- **Expect wait times:** the GPU is often shared, so a render takes about 1 minute when idle and 6–10 minutes when busy.
- **Don't close other people's apps** without explicit permission, and then only with a normal (non-forced) close.

## Tools used

- **REA** (reverse-engineer-anything): browser capture and CSS/DOM/JS-bundle analysis of the reference sites. Also used for every screenshot review of this site, including the `?at=` review frames.
- **Swift + AVFoundation:** frame extraction from the client's `.mov` recordings (ffmpeg isn't installed on the dev machine).
