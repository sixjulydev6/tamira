# Tamira website

Marketing site for **Tamira**, a wiring and cable company. Built by Sixjuly.

> **Good wiring is the kind you never think about.**

The homepage is a single scroll-driven story.

1. A live GLB skyline moves from daylight to dusk, then dissolves into architectural scan lines and LiDAR points.
2. An underground network connects the city; one feeder climbs the tower to a furnished room that builds and lights up.
3. The camera follows the ceiling cable into a three-core construction reveal. Red pulls out from blue and green; the camera follows it into the existing single-wire story as the page turns light.
4. The existing wire story continues through copper, strands, flex, heat, flame and smoke.
5. The red wire seats in the rear switchboard, black and green follow into N/E, and the original camera enters the final rendered living-room sequence.

The hero retains the existing Tamira fonts, header and copy layout. See [docs/SKYLINE-HERO.md](docs/SKYLINE-HERO.md) for the supplied project's integration and review links.

The other site sections (Consumers, Industries, Investors, Company) come in a later stage.

## Run

```bash
npm install
npm run dev       # http://localhost:5180 (add -- --port 5180 --strictPort if Vite picks another port)
npm run build     # production build → dist/
npm run preview   # serve dist/
```

**Review shortcut (dev only):** add `?at=<segment>:<t>` to the URL to jump to any moment. For example:
- `http://localhost:5180/?at=run:0.75` shows the wire running with the city lighting up.
- `http://localhost:5180/?at=heat:0.6` shows the heat chapter.

Segment ids are listed in [docs/STORY.md](docs/STORY.md).

## Stack

The site is plain HTML, CSS and JavaScript, with no framework. Versions are pinned exactly in `package.json`; keep them pinned.

| Package | Version | Used for |
|---|---|---|
| Vite | 5.4.10 | dev server and build |
| GSAP + ScrollTrigger | 3.12.5 | the one scroll timeline and the page-load reveal |
| Three.js | 0.170.0 | the wireframe city and the wire, all live 3D |

Three.js and the story scene are lazy-loaded after first paint. The opening loads the supplied optimized skyline GLB and 2K atlas, then renders the scan, wiring and tower room live. Matching desktop/portrait posters cover loading and static fallback. The final living room uses the 48 rebuilt rendered images. The old clay-city implementation and offline assets remain as references; normal browsing no longer loads that opener.


## Current handoff

Local commit `798e73c` contains the earlier site/room updates; its push needs explicit destination approval after automatic review blocked it. The new skyline opening is an uncommitted integration. Build and desktop/portrait skyline/finale checks pass in muted Comet. See [docs/CURRENT-CONTEXT.md](docs/CURRENT-CONTEXT.md).


## Documentation

| Doc | Read it for |
|---|---|
| [docs/CURRENT-CONTEXT.md](docs/CURRENT-CONTEXT.md) | Latest accepted direction, delivery state, verification limits and next review |
| [docs/STORY.md](docs/STORY.md) | The scroll story beat by beat: what happens, where it happens in the scroll, and the knobs to retune it |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organised, the render pipeline, the city-to-product hand-over, and how to add or change things |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Grid, type scale, colours, composition rules and motion rules |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every client direction and design decision so far, in order, including rejected options |
| [docs/REFERENCES-AND-ASSETS.md](docs/REFERENCES-AND-ASSETS.md) | Reference sites and storyboards, the Blender source project, and shared-render-machine rules |
| [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) | Placeholders, known issues, open questions for the client, and a pre-launch checklist |
| [CLAUDE.md](CLAUDE.md) | A compact working brief for AI coding sessions on this repo |
