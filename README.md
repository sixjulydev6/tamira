# Tamira website

Marketing site for **Tamira**, a wiring and cable company. Built by Sixjuly.

> **Good wiring is the kind you never think about.**

The homepage is a single scroll-driven story.

1. An isometric **day city** turns into a glowing cyan **wireframe network**.
2. A red single-core **house wire** runs along an avenue through it. The street lights and buildings light up behind its tip as it passes.
3. The camera pushes in on the wire, the city drains away into its tip, and the page turns light.
4. The same wire then tells the product story: copper, strands, flex, heat, flame, smoke, and a finale.

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

Three.js and the 3D scene are built as a separate chunk of about 146 KB gzipped. It loads after first paint, so the hero never waits for it. The only media the hero loads is one image (`public/media/hero-day.jpg`).

## Documentation

| Doc | Read it for |
|---|---|
| [docs/STORY.md](docs/STORY.md) | The scroll story beat by beat: what happens, where it happens in the scroll, and the knobs to retune it |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organised, the render pipeline, the city-to-product hand-over, and how to add or change things |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Grid, type scale, colours, composition rules and motion rules |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every client direction and design decision so far, in order, including rejected options |
| [docs/REFERENCES-AND-ASSETS.md](docs/REFERENCES-AND-ASSETS.md) | Reference sites and storyboards, the Blender source project, and shared-render-machine rules |
| [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) | Placeholders, known issues, open questions for the client, and a pre-launch checklist |
| [CLAUDE.md](CLAUDE.md) | A compact working brief for AI coding sessions on this repo |
