> **2026-11-05 skyline update:** the old clay-city/avenue opener described below is replaced by the supplied GLB city, architectural scan, underground network, tower room and ceiling-wire sequence. The existing single-core product story and final room remain. See [SKYLINE-HERO.md](SKYLINE-HERO.md) for current implementation and segment meanings.

# The scroll story

The whole homepage is one pinned stage. A single scroll progress value `p` (0 → 1) drives everything:
- the page colour
- the 3D camera, wire and shaders
- the copy, the labels and the gauge

Each of these is a pure function of `p`. Nothing moves on a timer, so scrolling back reverses everything exactly. The only time-based motion is the one-off page-load reveal and live daylight traffic on the GSAP ticker, paused when daylight is hidden.

## How the scroll is divided

The story is split into **segments**. Each segment gets a length in **screens**, where one screen is one viewport height of scrolling. They are defined in `src/story/timeline.js`:

| # | Segment | Screens | What happens |
|---|---|---|---|
| 1 | `day` | 0.35 | Street level inside the rounded hero frame: headline top-left (the crown tower rises in front of it), sentence bottom-left, button bottom-right. A short beat before anything moves. |
| 1b | `rise` | 1.6 | The copy lifts away and the camera rises from street level to the isometric view (live Three.js geometry). |
| 2 | `wireOn` | 1.2 | The day city turns into the wireframe: the page goes white → warm night and orange lines climb the same buildings. |
| 3 | `extend` | 1.4 | The camera pulls back; a larger wireframe city grows in around a street-lit avenue. |
| 4 | `run` | 2.2 | The red wire runs along the avenue. Street lights and buildings light up behind its tip. |
| 5 | `approach` | 1.4 | One continuous push-in from the wide diagonal view to a close diagonal of the wire. |
| 6 | `drain` | 1.0 | The city drains into the wire's tip fast, the page turns lavender, and the tip lifts and settles. |
| 7 | `wireIn` | 0.9 | Hand-over to the product wire: an identical frame, the same lighting, plain copper. |
| 8 | `copper` | 1.5 | Chapter: "Tamira is named after copper." |
| 9 | `strands` | 1.7 | Chapter: "Thirty strands do the work together." |
| 10 | `flex` | 1.7 | Chapter: "Tight corners are no problem." |
| 11 | `heat` | 1.9 | Chapter: "Indian summers don't bother it." |
| 12 | `flame` | 1.7 | Chapter: "If it catches fire, it puts itself out." |
| 13 | `smoke` | 1.3 | Chapter: "It gives off less smoke, too." |
| 14 | `finale` | 4.0 | Same red wire seats in L at the original board rear, then black (N) and green (E); original camera arc to the front. |
| 15 | `room` | 3.0 | Original rendered room pullback and five lighting groups, then dark close. |

- **Total:** 26.85 screens of story. The `.story` section is `(26.85 + 1) × 100svh` tall; the extra screen is the pinned stage itself.
- **Retuning pacing:** change the `screens` values. Everything inside a segment is expressed as 0–1 progress through it (`local(p, id)`), so lengths can change freely.
- **Jumping to a moment (dev only):** `?at=<segment>:<t>`, for example `?at=approach:0.99`.

## Beat by beat

### 1. Day (`day`)
- **Current composition (DECISIONS 27):** the stage is a rounded frame (12px inset, 20px radius on desktop) on a white page surround, with a daylight sky gradient behind the live city. Wordmark top-left, frosted nav panel top-right, headline top-left, sentence bottom-left over a soft haze, two-part "Talk to us" button bottom-right. The camera and city framing below are unchanged. Earlier layout, kept for history: the header; the centred headline "Good wiring is the kind / you never think about"; full bleed behind and around it, a street-level shot of the same clay city (camera on the −Y side, 50 mm, 35 m up, 430 m out, looking slightly up), the orange crown tower centred and unobstructed (93%, measured by ray casts), white sky. The tower's top cuts into the headline's second line (the tower layer sits in front of the words, as in the client's reference); the sentence and "Talk to us" sit in the left column over the sky. On phones the copy is centred at the top and the street-level picture starts shrunk to a skyline ~2.1 screens wide along the bottom.
- **First-paint/fallback picture:** `hero-rise-{1920,3840}.webp` (`.hero__opening`), rise frame 0 rendered at 3840, sky transparent so the page and the headline show through. The far ground fades to transparent beyond the isometric frame (render setting only; the asset is unchanged).
- **Page load:** the header fades in; the two masked headline lines rise (0.8s, 0.05s stagger) with the sentence; the button pops in from 0.4s; the street-level picture fades in.

### 1b. The rise (`rise`)

The headline, sentence and action lift and fade over the first 20%. The hero frame's inset and corner radius open to zero over the first 35%, and the sky tint fades into the page colour over 55–95%, so the wireframe handover meets the same full-screen frame as before. `daylight.js` moves the live camera from street-level perspective into the matching isometric composition. The city is generated from `art/data/city-layout.json`; it includes 37 buildings, 1,721 windows and 54 moving cars. Phone skyline framing follows the current camera implementation. No rise WebP sequence or traffic video is requested. The opening transparent still remains for first paint/static fallback. See [LIVE-3D.md](LIVE-3D.md).

### 2. Day → wireframe (`wireOn`)
- **Page colour:** white → warm night (`#140b07`) over roughly 12–50% of the segment.
- **The live handover:** the shared city renderer composites the daylight city into the wireframe. It draws:
  - a backdrop in the page colour
  - dark hulls for the buildings
  - crown-orange lines that climb the buildings from street level
- **Why the lines line up:** they are drawn exactly on the render's building edges, because the 3D city is a port of the Blender layout and the 3D camera reproduces the Blender camera (see [ARCHITECTURE.md](ARCHITECTURE.md#the-exact-hand-off-from-the-day-image)).
- **Glow and headline:** the glow (bloom) only comes up once the page is dark, and the headline turns white at the same time. This avoids a washed-out pale-blue middle state.
- **No night stage.** There used to be a day → night video. It was removed so the city only lights up once, when the wire passes ([DECISIONS.md](DECISIONS.md)).

### 3. Extend (`extend`)
- **Camera:** pulls back from a 400 m frame to a 780 m frame and recentres on the avenue. The headline stays.
- **The outer city:** grows in around the original layout. It is generated but deterministic, so it's the same on every load.
- **The avenue:** a long road along world Y at x = 228 m, with kerb lines and street-light poles on both sides every 36 m. On screen it's a lower-left → upper-right diagonal, in the place of the train in the client's reference images.

### 4. Run (`run`)
- **The wire:** the red Tamira wire travels along the avenue at street level, with no bridge or platform. It starts off-screen at the lower-left and stops at y = 120 m. Its copper tip carries an ember-orange glow.
- **Street lights:** each one switches on (warm amber glow, plus a pool of light on the street) the moment the tip reaches it, never before.
- **Buildings:** light up in sync with the tip. A building lights once the tip is level with it, and buildings further from the avenue light a beat later.
  - Lit buildings fill their facades with golden windows. Only the windows light: outlines and walls stay as they were.
  - Each window switches on at its own moment.
  - Nothing ever lights ahead of the wire.
- **Headline:** lifts away at the start of the run, clearing the lower-left for the wire.

### 5. Approach (`approach`)
- **The camera move:** one continuous push-in, toward the wire's tip.
  - The wire already runs lower-left → upper-right in the wide view, so the camera only eases about 45° round and levels off.
  - It never goes behind or above the wire.
- **The city:** keeps lighting up beyond the tip, so the whole city is glowing as the camera arrives.
- **End frame:** the wire is a close diagonal across the frame, its tip still on the street, with lit buildings and street lights behind.
- **A clear patch:** the area on the near side of the avenue that the camera crosses is kept free of buildings, because the city wire is drawn on top of the city (see [OPEN-ITEMS.md](OPEN-ITEMS.md)).

### 6. Drain (`drain`)
This beat is fast.

| Point in the drain | What has happened |
|---|---|
| ~0–25% | The whole network (lines, hulls, street lights) drains into the wire's tip: a shrinking screen-space circle with a bright leading edge. The city is gone. |
| ~14–42% | The page goes warm night → lavender (`#e4e4ee`). The text turns dark. |
| After that | The tip lifts into the product wire's opening shape, and the camera finishes settling on the hand-over frame against the clean background. Over 30–95% the tail straightens onto the product wire's path and length, and the ember glow cools to copper (DECISIONS 28). |

### 7. Hand-over (`wireIn`)
- **The swap:** the drain ends on exactly the frame the product wire starts from. The product canvas fades in over it, and there is no visible cut.
- **One look:** the glow has already cooled during the drain, and both copies share lights, environment orientation, tone mapping, path and tail, so the product wire matches the frame it replaces.

### 8–14. Product chapters
Each chapter's copy (title, body, spec line) appears in the upper-left column. The wire and props work on the right. Each chapter gets a soft background tint.

| Chapter | Visual | Copy (placeholder specs, see [OPEN-ITEMS.md](OPEN-ITEMS.md)) |
|---|---|---|
| `copper` | Camera close on the stripped tip; the 30 copper strands fan out | Tamira is named after copper. 99.97% pure. |
| `strands` | The front half of the jacket is cut away to show the strands; three labels are pinned to the 3D (Copper · Jacket · Rated for 1100 V) | Thirty strands do the work together. |
| `flex` | The wire bends into a tight elbow through a clear conduit | Tight corners are no problem. |
| `heat` | A heater block rises under the wire; orange heat glows along the jacket; a gauge counts 25 → 85°C (70°C ordinary PVC, 85°C Tamira) | Indian summers don't bother it. |
| `flame` | A flame touches the jacket, chars it, and dies out | If it catches fire, it puts itself out. |
| `smoke` | Thin grey wisps rise from the char | It gives off less smoke, too. |
| `finale` | Same red cable into the original rear red terminal; original screw/pulse and camera arc | Wire it once, and forget it's there. |

### 14–15. Three-wire connection and room

The same product `Wire` and `wireScene` remain in use. The cable path/scale morph and smoke camera bridge finish by source time 6.32. The original camera spline then runs unchanged: rear box; red (the continuous product wire) seats in L at 6.38–6.50, then fresh black and green lengths slide up into N (6.46–6.58) and E (6.54–6.66), each with its own screw click (red 6.50–6.53, black 6.58–6.61, green 6.66–6.69) (cubic easing, DECISIONS 29); arc around the wall, front plate, room-camera match. No canvas opacity dip. The user rejected added travelling-tip camera motion.

`finale` maps source time 6.06–7.06; `room` maps 7.06–7.94. The room is painted from original images, starting only after a decoded frame is available. It pulls back and switches on downlights, pendant, sconces, arc lamp and TV-unit strip. The room darkens at the close before the existing contact section. This later close is separate from the removed smoke-to-board fade.

The rear-board visibility fix restores the group's visibility on every update, independently of cached material fade. It is implemented but still needs completed visual confirmation in Comet; earlier alignment checks missed the hidden geometry. See [ROOM-FINALE.md](ROOM-FINALE.md).

After the story, a plain `.end` section ("Talk to us about your next build" plus a Contact button) closes the page. It's a stand-in for the rest of the site.

## Tuning knobs

Most retuning is a number in one of these places:

| To change | Where |
|---|---|
| Length of any beat | `SEGMENTS` in `src/story/timeline.js` |
| Page colours and when they change | `COLORS` and `pageColors()` in `src/story/palette.js` |
| When the day image and canvases fade | `render()` in `src/main.js` (`heroStage`, `canvas`, `wireCanvas` opacity) |
| Wide-view framing | `EXT_TARGET`, `EXT_FRAME_W` in `src/story/scene.js` |
| Push-in progress (how much happens in approach vs drain) | `approachK` in `src/story/scene.js` |
| Drain speed, bloom strength | `update()` in `src/story/scene.js` (`uDrain`, `uFade`, `bloom.strength`) |
| Where the wire stops, the avenue, street-light spacing | `AVENUE` in `src/story/city.js` |
| How buildings light (spread, window brightness) | `powerLit`, `windowsOn`, `litFacade` in `src/story/city.js`; the `uPower` line in `scene.js` |
| Street-light glow size and brightness | `lampMesh()` in `src/story/city.js` |
| Wire path shapes per chapter | `SHAPES` in `src/story/scene.js` (normalised screen space) |
| Chapter camera moves | `poses` in `wireState()` in `src/story/scene.js` |
| Copy, labels, gauge values | `src/story/chapters.js` |

## Review links

With `npm run dev` running:

```
?at=day:0.5          street-level hero
?at=rise:0.5         mid-rise
?at=rise:0.97        landing on the isometric view
?at=wireOn:0.4       day → wireframe, mid-transition
?at=wireOn:0.95      wireframe city
?at=extend:0.95      pulled-back city with the avenue
?at=run:0.4          wire entering, nothing lit yet
?at=run:0.75         city lit behind the tip, dark ahead
?at=approach:0.5     mid push-in
?at=approach:0.99    the close diagonal frame
?at=drain:0.22       city gone, page lightening
?at=wireIn:0.6       product wire
?at=copper:0.55  ?at=strands:0.6  ?at=flex:0.6  ?at=heat:0.6  ?at=flame:0.35  ?at=smoke:0.45  ?at=finale:0.45  ?at=finale:0.8  ?at=room:0.55
```

## Reduced motion and no WebGL

When the user prefers reduced motion, or WebGL is unavailable, the page switches to a static layout (`.story.is-static`):
- there is no scroll story
- the day image shows
- the chapter copy is laid out as plain sections
- the header gets a solid background

The static layout also includes the original fully lit room still. Browser review must use **Comet**. Current delivery and verification limits: [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md).
