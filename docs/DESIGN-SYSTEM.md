> **Live rendering:** the daylight city uses beveled Three.js geometry, satin PBR materials, environment lighting and directional shadows. Physical scene shadows are intentional. Hero typography, composition and grid remain unchanged. See [LIVE-3D.md](LIVE-3D.md).

# Design system

## Grid

The layout, spacing and type metrics are adapted from **arrakis.tech**. They were measured with REA from that site's shipped CSS and DOM. Only the metrics were taken, not its fonts or imagery.

| Token | Value | Notes |
|---|---|---|
| `--space` | 4px (0.25rem) | the spacing base; everything is a multiple |
| `--container` | 84rem (1344px) | max content width, centred |
| `--pad-x` | 20px, 48px from 1024px | side padding |
| `--page-x` | `max(--pad-x, (100% − 84rem) / 2)` | puts full-bleed blocks on the grid; use it as `padding-inline` instead of wrapper elements |
| `--content-x` | = `--hero-media-margin`: 16px, then from 1024px `max(16px, (100vw − (100svh − 112px) × 1.65625) / 2)` (67px at 1440×900, 158px at 1920×1080) | the framed city's side margin; the header (wordmark, Contact, phone menu), chapter copy, the gauge and the Contact section line up with it. Replaced the old `--indent` (52px) |
| `--header-height` | 64px, 86px from 640px | |

### Header
- **Height and alignment:** 64 / 86px tall, contents centred vertically. Side edges are `--content-x`: the logo starts and the Contact button (or the phone Menu) ends on the framed city's edges.
- **Logo:** the client's SVG (`public/tamira-logo.svg`, 876 × 145, coral `#F45E5E`), 20px tall (~121px wide), in a link at least 40px tall.
- **Nav:** Consumers, Industries, Investors, Company, with 48px between items.
- **Contact us:** an outlined red button on the far right (2px radius, padding 9 × 14px). It's outlined rather than filled because white text on the red is under 4.5:1 contrast at nav size.
- **Below 1024px:** the nav collapses into a "Menu" dropdown.

### Composition rule: words left, object right
- **Hero (the one exception):** the headline is centred under the header, and the street-level crown tower rises in front of its second line (client reference, DECISIONS 20); the picture is full bleed with a white sky. It is the page's one centred moment. The sentence and button sit in the left column (`--content-x`) over the sky, never over the tower; on phones they are centred under the headline and the skyline sits along the bottom.
- **Hero button:** flat ink fill, white text, 2px radius, 44px tall. Ink rather than red because white on the brand red is under 4.5:1 at this size.
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
| `--text-display` | 36 → 56px | hero headline |
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
| Wire tip glow | `(1.0, 0.5, 0.16)` ember | copper strands in the city, cooling to copper at the hand-over |
| Lavender | `#e4e4ee` | the wire's world |
| Chapter tints | copper `#ece5df`, heat `#efe5da`, flame `#e4e7e3`, smoke `#e6e6ea` | soft per-chapter backgrounds |
| Wire jacket | `#c21d19` with legend in `rgba(255, 232, 224, 0.62)` | |
| Copper | `#d08a5a` (metal) | strands |
| Ink | `#000` day · `#f3f1ee` on the warm night · `#1b1b22` on lavender | text; flips quickly so it's never grey-on-grey |

**How page colour is driven:** it is set from scroll by `pageColors()` (`src/story/palette.js`) into `--bg` and `--ink`. Both canvases clear to the same colour, so the page and the 3D never show a seam.

## Motion rules

- **All story motion is scroll-driven and reversible.** No timers. The time-based motion is the page-load reveal (the header fades in, the headline lines rise in turn with a 0.1s stagger, and the city fades in) and the hero's traffic loop (client request, DECISIONS 15).
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
