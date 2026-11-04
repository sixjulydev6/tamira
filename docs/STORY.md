# The scroll story

The whole homepage is one pinned stage. A single scroll progress value `p` (0 → 1) drives everything:
- the page colour
- the 3D camera, wire and shaders
- the copy, the labels and the gauge

Each of these is a pure function of `p`. Nothing moves on a timer, so scrolling back reverses everything exactly. The only time-based motion is the one-off page-load reveal and the hero's traffic loop, a fixed backdrop that pauses once the wireframe takes over.

## How the scroll is divided

The story is split into **segments**. Each segment gets a length in **screens**, where one screen is one viewport height of scrolling. They are defined in `src/story/timeline.js`:

| # | Segment | Screens | What happens |
|---|---|---|---|
| 1 | `day` | 0.35 | Centred headline, one sentence and one button over a framed day city. A short beat before anything moves. |
| 1b | `open` | 1.2 | The copy lifts away and the frame opens to the full screen: the immersive city, held still. |
| 2 | `wireOn` | 1.2 | The day city turns into the wireframe: the page goes white → warm night and orange lines climb the same buildings. |
| 3 | `extend` | 1.4 | The camera pulls back; a larger wireframe city grows in around a street-lit avenue. |
| 4 | `run` | 2.2 | The red wire runs along the avenue. Street lights and buildings light up behind its tip. |
| 5 | `approach` | 1.4 | One continuous push-in from the wide diagonal view to a close diagonal of the wire. |
| 6 | `drain` | 1.0 | The city drains into the wire's tip fast, the page turns lavender, and the tip lifts and settles. |
| 7 | `wireIn` | 0.9 | Hand-over to the product wire (an identical frame), whose glow cools to copper. |
| 8 | `copper` | 1.5 | Chapter: "Tamira is named after copper." |
| 9 | `strands` | 1.7 | Chapter: "Thirty strands do the work together." |
| 10 | `flex` | 1.7 | Chapter: "Tight corners are no problem." |
| 11 | `heat` | 1.9 | Chapter: "Indian summers don't bother it." |
| 12 | `flame` | 1.7 | Chapter: "If it catches fire, it puts itself out." |
| 13 | `smoke` | 1.3 | Chapter: "It gives off less smoke, too." |
| 14 | `finale` | 1.7 | Chapter: "Wire it once, and forget it's there." |

- **Total:** 21.15 screens of story. The `.story` section is `(21.15 + 1) × 100svh` tall; the extra screen is the pinned stage itself.
- **Retuning pacing:** change the `screens` values. Everything inside a segment is expressed as 0–1 progress through it (`local(p, id)`), so lengths can change freely.
- **Jumping to a moment (dev only):** `?at=<segment>:<t>`, for example `?at=approach:0.99`.

## Beat by beat

### 1. Day (`day`)
- **What's on screen:** the header; under it, centred, the headline "Good wiring is the kind / you never think about", one sentence ("Tamira makes copper house wire for homes and buildings: safe, flexible, and built to last.") and one button ("Talk to us" → contact). Below that, the day city (`hero-city-*`, the clay Cycles render) in a frame on the page grid: equal side margins, running to the bottom of the viewport, square corners, the crown tower centred with its whole star inside the frame.
- **How the frame works:** the city is one full-screen `object-fit: cover` layer. `main.js` (`layoutFrame` / `setFrame`) clips it to the frame with `clip-path: inset()` and scales/moves the image so the crown sits in the frame. There are no CSS masks.
- **Traffic:** after page load a 10 s seamless loop of small clay cars driving the streets fades in over the still (`.hero__video`, `hero-traffic-2560.webm` / `.mp4`, rendered by `art/blender/animate_city.py`). Same camera and city, so it's the poster with cars moving; frame 0 is the poster. It keeps playing while the frame opens and pauses once `wireOn` hides the image. Not loaded under reduced motion or Save-Data.
- **Page load:** the header fades in, the two headline lines rise in turn, the sentence and button follow, and the framed city fades in. Then the traffic loop starts over the still (below).

### 1b. The frame opens (`open`)
- **0–20%:** the headline, sentence and button rise 24px and fade out (gone before the frame's edge reaches them).
- **14–85%:** the clip opens to the full screen while the image scales/moves back to its plain full-screen cover framing (a pure function of scroll, reversible).
- **85–100%:** the full-screen city holds: the immersive beat. The image is now exactly the frame the wireframe hand-over is aligned to.
- Pattern adapted from incident.io's hero (a framed panel under a centred headline that grows as you scroll), with the city in place of a product mock-up and opening all the way to full bleed.

### 2. Day → wireframe (`wireOn`)
- **Page colour:** white → warm night (`#140b07`) over roughly 12–50% of the segment.
- **The hand-over to 3D:** the city canvas fades in over the image. It draws:
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
| After that | The tip lifts into the product wire's opening shape, and the camera finishes settling on the hand-over frame against the clean background. |

### 7. Hand-over (`wireIn`)
- **The swap:** the drain ends on exactly the frame the product wire starts from. The product canvas fades in over it, and there is no visible cut.
- **The glow:** the copper strands' ember glow cools to copper.

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
| `finale` | The wire runs into a wall switch plate; the rocker flips and the LED goes green | Wire it once, and forget it's there. |

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
?at=day:0.5          day hero (framed)
?at=open:0.5         frame opening
?at=open:0.95        full-screen city
?at=wireOn:0.4       day → wireframe, mid-transition
?at=wireOn:0.95      wireframe city
?at=extend:0.95      pulled-back city with the avenue
?at=run:0.4          wire entering, nothing lit yet
?at=run:0.75         city lit behind the tip, dark ahead
?at=approach:0.5     mid push-in
?at=approach:0.99    the close diagonal frame
?at=drain:0.22       city gone, page lightening
?at=wireIn:0.6       product wire
?at=copper:0.55  ?at=strands:0.6  ?at=flex:0.6  ?at=heat:0.6  ?at=flame:0.35  ?at=smoke:0.45  ?at=finale:0.8
```

## Reduced motion and no WebGL

When the user prefers reduced motion, or WebGL is unavailable, the page switches to a static layout (`.story.is-static`):
- there is no scroll story
- the day image shows
- the chapter copy is laid out as plain sections
- the header gets a solid background
