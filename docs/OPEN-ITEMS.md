# Open items

## Placeholders to replace

| Item | Where | Needs |
|---|---|---|
| **Product specs** (99.97% purity, 13.3 Ω/km, 30 × 0.25 mm strands, 0.7 mm jacket, 1100 V, Class 5 / IS 8130, 85°C / 160°C, oxygen index 29%, temperature index 250°C, IEC 60332-1, smoke 60%, acid gas 20%) | `src/story/chapters.js`; the gauge (70 / 85°C) in `GAUGE` | Tamira's confirmed figures. These came from the Sixjuly concept and are typical for HR-FR-LSH wire to IS 694, **not Tamira test results**. |
| Printed legend on the wire ("TAMIRA 1.5 SQ MM HR-FR-LSH 1100 V") | `legendTexture()` in `src/story/wire.js` | The real marking |
| Logo on the dark wireframe | `.wordmark` | The coral logo sits on orange lines during the wireframe and reads weaker than the nav (which turns white). Options: a white logo while the page is dark (`.is-dark`), or leave it. Client call |
| Brand font | Geist Serif headings and Instrument Sans body/UI; actual SVG logo is in place | Client font approval or licensed replacement |
| Favicon | `public/favicon.svg` | The real icon |
| Nav links | `#consumers`, `#industries`, `#investors`, `#company` | The real pages or sections |
| End / Contact section | `.end` in `index.html` | Real copy, and a real address (currently `mailto:hello@tamira.example`) |
| Finale | Red product wire + black + green → original switchboard rear → living room | Implemented with original camera/red insertion timing and room assets; rear visibility fix needs final Comet review; see `ROOM-FINALE.md`. |
| Props | Procedural conduit, heater, flame, smoke, switch plate | Optional Blender GLBs for higher fidelity |
| Hero sentence | `.hero__lede` in `index.html` | Client sign-off on "Tamira makes copper house wire for homes and buildings: safe, flexible, and built to last." |
| Fallback opening still | `public/media/hero-rise-*.webp` | Replace the low-sample first-paint / reduced-motion still before launch. Normal browsing uses live geometry; rise-frame rendering is no longer a blocker. |
| Hero finish sign-off | `public/media/hero-city-*` | A side-by-side against the client's quality references (images 2–4 of the brief), which weren't available as files when the render was tuned |

## Open questions for the client

1. **Real specs and size range** for the house wire (see above).
2. **Finale resolved:** single red wire using the original three-wire camera/interaction, followed by the original room and five lighting steps (decisions 23–26).
3. **Other sections:** do Consumers, Industries, Investors and Company follow on the homepage, or are they separate pages?
4. **Street-light colour:** now warm white against the orange city (it was amber against cyan before DECISIONS 17; echoing the yellow dashed lights in the reference). Should it match the cyan instead?
5. **Extended city style:** retain current warm wireframe unless new direction is given; daylight opening already uses solid PBR geometry.
6. **Source code resolved:** the supplied GitHub repository was inspected and the original ending ported. See `ROOM-FINALE.md` for provenance.

## Latest verification gap

The rear-board visibility bug is fixed in `6d33386`, but the final Comet visual pass and expanded visibility assertion remain outstanding. The earlier room alignment/lighting tests passed while missing this bug. Review the actual rendered geometry, not only projected coordinates. Browser access must use Comet. See [CURRENT-CONTEXT.md](CURRENT-CONTEXT.md).

## Known issues and limitations

- **The city wire is drawn on top of the city.** It renders after the bloom pass so it stays crisp, so buildings can't occlude it.
  - Current workaround: the avenue and the patch on its near side that the camera crosses (`approachPath`) are kept free of buildings, which reads as open ground in the wide view.
  - Proper fix: render the wire inside the city pass with a selective-bloom setup.
- **Legend aliasing:** at a distance the city wire's printed legend can shimmer into white specks. Possible fixes: a mip bias, fading the legend with distance, or a lower-contrast legend for the city wire.
- **Not tested on real devices.** Earlier automated checks used isolated Chrome/CDP at desktop/portrait sizes. The user now requires Comet; its post-fix review timed out and is incomplete. Do not attribute all screenshot checks to REA.
- **Performance:**
  - Two WebGL contexts, bloom on the city, and a CPU rebuild of the wire geometry per scroll tick.
  - Should be profiled on mid-range Android and iOS.
  - Consider a lower pixel ratio or no bloom on low-end GPUs.
- **Unused media** (`hero-day.jpg`, `hero-day-night*.mp4`, `hero-night.jpg`) still ships in `dist/`.
- **Phone hero framing:** the live camera retains the phone skyline fit. Inspect it at actual portrait sizes in Comet and on physical devices; the normal rise is geometry, not an image sequence.
- **Realtime daylight:** profile the PBR city and 4096² desktop / 2048² mobile shadows on real devices. The old 72-frame rise sequence no longer loads; old files still need deployment cleanup.
- **`?at=run:0.75` shows the wire but no city** when reached by the dev `?at=` jump, in headless **and** headed Chrome (dark page, no lines or lit buildings); the same for `?at=approach:0.99`. Scrolling there renders the city correctly (checked 2026-11-04), so it is a state the jump skips, not a rendering failure. It is the same on the commit before the framed hero, so it predates it; check in a real browser by scrolling, then investigate `scene.js` / `city.js` around the run.
- **Static fallback hero** (`.story.is-static`, 70svh stage) loses the crown's top under the top mask fade on desktop. This was the same before the new render.
- **Static fallback** (reduced motion / no WebGL) is functional but plain. It has no chapter visuals, only the day image and the copy.
- **Phone heat chapter:** the gauge has been moved above the heater on portrait screens; verify on physical phones and short landscape viewports.
- **Labels** in the strands chapter are positioned from 3D points and can overlap the copy on very short viewports.

## Pre-launch checklist

- [ ] Replace placeholder specs, legend, logo, font, favicon, contact address
- [x] Port the original board/room, adapt to one red wire and original source camera timing (decisions 23–25)
- [ ] Complete Comet rear-board visibility/framing review after the cached-visibility fix (decision 26)
- [ ] Rerun the expanded `boardVisible` regression assertion
- [ ] Remove unused media from `public/media/` (now including `hero-day.jpg`)
- [ ] Client sign-off on the clay hero against their reference images
- [ ] Real-device testing: iPhone Safari, Android Chrome, low-end laptop
- [ ] Performance profiling; adaptive quality if needed
- [ ] Accessibility pass: screen-reader order of chapter copy, focus states, contrast on every background tint
- [ ] SEO: title, description, Open Graph image (a still of the wireframe city or the wire)
- [ ] Analytics
- [ ] Deployment target and caching (latest scene chunk approximately 610 kB / 164 kB gzipped; main approximately 132 kB / 53 kB gzipped)
- [ ] Remove or keep the dev-only `?at=` jump (it's compiled out of production builds already)
