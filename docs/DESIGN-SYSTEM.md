> **Live rendering:** the daylight city uses beveled Three.js geometry, satin PBR materials, environment lighting and directional shadows. Physical scene shadows are intentional. Hero frame, composition and header follow the Integrated Biosciences study (DECISIONS 27); typefaces are unchanged. See [LIVE-3D.md](LIVE-3D.md).

# Design system

## Grid

The layout, spacing and type metrics are adapted from **arrakis.tech**. They were measured with REA from that site's shipped CSS and DOM. Only the metrics were taken, not its fonts or imagery.

| Token | Value | Notes |
|---|---|---|
| `--space` | 4px (0.25rem) | the spacing base; everything is a multiple |
| `--container` | 84rem (1344px) | max content width, centred |
| `--pad-x` | 20px, 48px from 1024px | side padding |
| `--page-x` | `max(--pad-x, (100% − 84rem) / 2)` | puts full-bleed blocks on the grid; use it as `padding-inline` instead of wrapper elements |
| `--frame-inset` / `--frame-radius` | 8px, 12px from 1024px / 20px | the hero frame: the stage is clipped to this rounded inset at first paint and opens to zero over `rise` 0–0.35 |
| `--hero-pad` | 24px, 48px from 1024px | padding inside the frame |
| `--hero-x` | `max(--frame-inset + --hero-pad, (100vw − 1524px) / 2)` (60px at 1440, 198px at 1920) | one centred 1524px container inside the frame |
| `--content-x` | = `--hero-x` | the shared left/right edge: wordmark, nav panel, hero copy, chapter copy, gauge and Contact section. (Previously the old framed city's margin.) |
| `--header-height` | 80px | chapter-copy offset only; the header itself is 54px tall at `--frame-inset` + 18px (30px) on desktop, 64px at `--frame-inset` + 12px on smaller screens |

### Header (Integrated Biosciences style, DECISIONS 27)
- **Desktop (1024px+):** the wordmark stands alone at the left edge (`--hero-x`). Navigation and Contact sit in one frosted panel at the right: 54px tall, 5px padding, 10px radius, 1px ink border at 10%, page colour at 70% with `blur(16px) saturate(1.4)`. Because it takes `--bg`/`--ink`, it reads light over the day city and dark over the night wireframe and room.
- **Logo:** the client's SVG (`public/tamira-logo.svg`, 876 × 145, coral `#F45E5E`), 20px tall (~121px wide), in a link at least 44px tall.
- **Nav links:** Consumers, Industries, Investors, Company; Instrument Sans 500, 13px, uppercase, 0.06em tracking, 42px tall with 18px side padding.
- **Contact us:** the panel's dark inner action (ink background, page-colour text, 7px radius); hover turns it red.
- **Below 1024px:** the whole header becomes one 64px frosted panel spanning the frame (12px in from it) with a dark uppercase Menu toggle; the dropdown opens under its right edge.

### Composition rule: words left, object right
- **Hero (DECISIONS 27):** a rounded media frame (`--frame-inset`, `--frame-radius`) holds the live street-level city on a daylight sky gradient (`--sky-top` `#d6e0e7` → `--sky-bottom` `#eef0ee`), with a white page surround. The headline sits top-left under the wordmark with the sentence directly under it, over the sky (`.hero__head`). The action sits alone at the bottom: right-aligned from 1025px, left-aligned below. The crown tower still layers in front of the headline. The sky-coloured haze behind the sentence was removed on 2026-11-05 at the user's request; the sentence now sits over clear sky, so it doesn't need one. On the first scroll the frame's inset and radius open to zero over `rise` 0–0.35 while the copy lifts; the sky fades into the page colour over `rise` 0.55–0.95, so the wireframe handover is unchanged.
- **Hero headline:** Geist Serif 400, `clamp(40px, 1.52rem + 3.36vw, 89.6px)` (73px at 1440; reduced 20% on 2026-11-05), line-height 1, tracking −0.03em, max-width 10.6em (two lines on desktop; runs on at 860px and below).
- **Hero sentence:** Instrument Sans, 18 → 24px, line-height 1.25, max-width 30rem, full ink.
- **Action (`.btn`):** a 48px two-part button: a dark `#1b1b22` label (13px uppercase Instrument Sans 500, 0.06em) and a red `#d9362c` arrow block, with parallel 10px slanted edges and a 3px gap. On hover the colours swap and the arrow moves 3px. Preserve the existing Tamira copy and destination.
- **Chapter copy:** upper-left, in a column about 31rem wide: title, then body, then a spec line.
- **The visual** (city, wire, props) works in the right two-thirds. Copy never centres over the object.
- **On phones:** copy sits at the top, and the wire is compressed into the lower part of the frame.

## Type

Fonts are **stand-ins** until the client supplies a brand font (the logo is final, see the header):
- **Geist Serif** (400, `--font-serif`) for every heading: the hero headline, chapter titles, the Contact title and the gauge number. Vercel's open-source serif (SIL OFL), self-hosted as `public/fonts/GeistSerifVF.woff2` (40 KB, preloaded) because it isn't on Google Fonts. Licence: `public/fonts/GeistSerif-OFL.txt`.
- **Instrument Sans** (400 / 500) for UI and copy.

Instrument Sans comes from Google Fonts.

### Fluid scale
Each size runs linearly from a 480px to a 1280px viewport, then holds.

| Token | Size | Used for |
|---|---|---|
| Hero `.hero__title` | 40 → 89.6px (`clamp(2.5rem, 1.52rem + 3.36vw, 5.6rem)`) | leading 1, tracking −0.03em; overrides the legacy `--text-display` token |
| `--text-heading-48` | 28 → 48px | end title, gauge number (Geist Serif) |
| `--text-heading-40` | 26 → 40px | chapter titles (Geist Serif) |
| `--text-body-20` | 17 → 20px | (available) |
| `--text-body-18` | 16 → 18px | chapter body, end body |
| `--text-body-15` | 15px | spec lines, label values |
| `--text-nav` | 14 → 15px | nav, buttons |

### Leading and tracking

| Style | Leading | Tracking |
|---|---|---|
| Display | 1.1, then 0.98 from 768px | −0.03em |
| Headings | 1.1, then 1.05 from 768px | −0.03em |
| Body | 1.5 | — |
| Body-20 | 1.3 | — |
| Nav | 1.2 | — |
| 15px text | — | +0.01em |

- **Weight:** the reference sets headings and body at weight 300. Instrument Sans has no 300, so we use 400.
- **Headings:** `text-wrap: balance`. **Body:** `text-wrap: pretty`.
- **Numbers:** spec lines and the gauge use tabular numerals.

## Colour

| Name | Value | Where |
|---|---|---|
| Accent red | `#ea3c32` | Contact button, end CTA (sampled from the client reference) |
| Logo coral | `#F45E5E` | inside the logo SVG only |
| Day page | `#ffffff` | hero |
| Warm night | `#140b07` | wireframe city (was navy `#060d1f`; DECISIONS 17) |
| Wireframe line | `#e8582a` (crown orange), hot `#ffc69c` (peach) | city lines (additive, with bloom); building hulls lift toward warm. Building outlines are thick strips (1.2 px, crown 1.4, extended city 1.0, plus a 0.5 px soft edge); interior grids are faint 1 px lines |
| Powered light | lamps `(1.0, 0.84, 0.6)`, windows `(1.0, 0.78, 0.48)` (linear, additive) | street lights and lit windows; a powered building lights only its windows, its outline stays orange |
| Wire tip glow | `(1.0, 0.5, 0.16)` ember | copper strands in the city; cools to plain copper over `drain` 0.3–0.95, after the city has faded, so the product wire starts with no glow (DECISIONS 28) |
| Lavender | `#e4e4ee` | the wire's world |
| Chapter tints | copper `#ece5df`, heat `#efe5da`, flame `#e4e7e3`, smoke `#e6e6ea` | soft per-chapter backgrounds |
| Wire jacket | `#c21d19` with legend in `rgba(255, 232, 224, 0.62)` | |
| Copper | `#d08a5a` (metal) | strands |
| Ink | `#000` day · `#f3f1ee` on the warm night · `#1b1b22` on lavender | text; flips quickly so it's never grey-on-grey |

**How page colour is driven:** it is set from scroll by `pageColors()` (`src/story/palette.js`) into `--bg` and `--ink`. Both canvases clear to the same colour, so the page and the 3D never show a seam.

## Motion rules

- **All story motion is scroll-driven and reversible.** No timers. The time-based motion is the page-load reveal (the header fades in; the masked headline lines rise 110% over 0.8s `power2.out` with a 0.05s stagger, the sentence with them; the action pops in from 0.4s over 0.6s `back.out(1.7)` from 90% scale; the city fades in) and live daylight traffic on the GSAP ticker (historical traffic-video request: decision 15; live replacement: decision 22).
- **UI motion:**
  - ease-out for entrances
  - transitions of 300ms or less
  - never `transition: all`
- **Interaction basics:**
  - minimum hit area 40–44px
  - visible focus (a 2px outline in accent red)
- **Reduced motion:** every animation has a reduced-motion path. With reduced motion on, the whole story becomes a static layout.

## Don'ts

- No generic template chrome: all-caps eyebrows, numbered markers, card grids, gradient washes. Use them only if the brief asks.
- Don't centre copy over the 3D object.
- Don't add ambient (time-based) animation without asking.
- Don't take fonts or imagery from reference sites; take only metrics and composition.

## Finale motion constraint

Keep the red cable continuously visible from smoke into the L terminal; black (`#161719`) and green (`#1a6633`) follow into N and E on the source timing (DECISIONS 29). Use the original three-wire camera choreography, with only the short smoke-camera bridge adapted. No extra tip-follow sweep or canvas fade. Preserve the later original room pullback, five lighting states and dark close. Comet visual approval of rear visibility is still pending after the visibility fix. See [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md).
