# Design system

## Grid

The layout, spacing and type metrics are adapted from **arrakis.tech**. They were measured with REA from that site's shipped CSS and DOM. Only the metrics were taken, not its fonts or imagery.

| Token | Value | Notes |
|---|---|---|
| `--space` | 4px (0.25rem) | the spacing base; everything is a multiple |
| `--container` | 84rem (1344px) | max content width, centred |
| `--pad-x` | 20px, 48px from 1024px | side padding |
| `--page-x` | `max(--pad-x, (100% − 84rem) / 2)` | puts full-bleed blocks on the grid; use it as `padding-inline` instead of wrapper elements |
| `--indent` | 0, 52px from 1024px | hero and chapter copy sit one extra step in from the grid on desktop |
| `--header-height` | 64px, 86px from 640px | |

### Header
- **Height and alignment:** 64 / 86px tall, contents centred vertically.
- **Wordmark:** fixed at about 102px wide (1.75rem Quicksand). 64px gap to the nav.
- **Nav:** Consumers, Industries, Investors, Company, with 48px between items.
- **Contact us:** an outlined red button on the far right (2px radius, padding 9 × 14px). It's outlined rather than filled because white text on the red is under 4.5:1 contrast at nav size.
- **Below 1024px:** the nav collapses into a "Menu" dropdown.

### Composition rule: words left, object right
- **Hero headline:** bottom-left, on the grid. Its bottom padding is 40px, then 48px from 640px, then 96px from 1024px.
- **Chapter copy:** upper-left, in a column about 31rem wide: title, then body, then a spec line.
- **The visual** (city, wire, props) works in the right two-thirds. Copy never centres over the object.
- **On phones:** copy sits at the top, and the wire is compressed into the lower part of the frame.

## Type

Fonts are **stand-ins** until the client supplies the real logo and brand font:
- **Instrument Sans** (400 / 500) for UI, headline and copy.
- **Quicksand 600** for the wordmark.

Both come from Google Fonts.

### Fluid scale
Each size runs linearly from a 480px to a 1280px viewport, then holds.

| Token | Size | Used for |
|---|---|---|
| `--text-display` | 36 → 56px | hero headline |
| `--text-heading-48` | 28 → 48px | end title, gauge number |
| `--text-heading-40` | 26 → 40px | chapter titles |
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
| Accent red | `#ea3c32` | wordmark, Contact button, end CTA (sampled from the client reference) |
| Day page | `#ffffff` | hero |
| Navy | `#060d1f` | wireframe city |
| Wireframe line | `#1c8fff`, hot `#8fe9ff` | city lines (additive, with bloom) |
| Warm light | lamps `(1.0, 0.74, 0.38)`, windows `(1.0, 0.55, 0.2)`, lit lines `(1.0, 0.6, 0.26)` (linear, additive) | street lights, lit buildings |
| Lavender | `#e4e4ee` | the wire's world |
| Chapter tints | copper `#ece5df`, heat `#efe5da`, flame `#e4e7e3`, smoke `#e6e6ea` | soft per-chapter backgrounds |
| Wire jacket | `#c21d19` with legend in `rgba(255, 232, 224, 0.62)` | |
| Copper | `#d08a5a` (metal) | strands |
| Ink | `#000` day · `#f3f1ee` on navy · `#1b1b22` on lavender | text; flips quickly so it's never grey-on-grey |

**How page colour is driven:** it is set from scroll by `pageColors()` (`src/story/palette.js`) into `--bg` and `--ink`. Both canvases clear to the same colour, so the page and the 3D never show a seam.

## Motion rules

- **All story motion is scroll-driven and reversible.** No timers, no ambient loops. The only time-based motion is the page-load reveal: the header fades in, the headline lines rise in turn with a 0.1s stagger, and the city fades in.
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
