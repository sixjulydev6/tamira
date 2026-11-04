# Open items

## Placeholders to replace

| Item | Where | Needs |
|---|---|---|
| **Product specs** (99.97% purity, 13.3 Ω/km, 30 × 0.25 mm strands, 0.7 mm jacket, 1100 V, Class 5 / IS 8130, 85°C / 160°C, oxygen index 29%, temperature index 250°C, IEC 60332-1, smoke 60%, acid gas 20%) | `src/story/chapters.js`; the gauge (70 / 85°C) in `GAUGE` | Tamira's confirmed figures. These came from the Sixjuly concept and are typical for HR-FR-LSH wire to IS 694, **not Tamira test results**. |
| Printed legend on the wire ("TAMIRA 1.5 SQ MM HR-FR-LSH 1100 V") | `legendTexture()` in `src/story/wire.js` | The real marking |
| Wordmark | `index.html` (live text in Quicksand) | The real logo file |
| Brand font | Instrument Sans stand-in | The real brand font |
| Favicon | `public/favicon.svg` | The real icon |
| Nav links | `#consumers`, `#industries`, `#investors`, `#company` | The real pages or sections |
| End / Contact section | `.end` in `index.html` | Real copy, and a real address (currently `mailto:hello@tamira.example`) |
| Finale | Wire into a wall switch plate | The client's choice of ending (see open questions) |
| Props | Procedural conduit, heater, flame, smoke, switch plate | Optional Blender GLBs for higher fidelity |

## Open questions for the client

1. **Real specs and size range** for the house wire (see above).
2. **Finale:** keep the switch plate, an interior room where the lights come on, or a return to the city?
3. **Other sections:** do Consumers, Industries, Investors and Company follow on the homepage, or are they separate pages?
4. **Street-light colour:** currently warm amber (contrast with the cyan city, echoing the yellow dashed lights in the reference). Should it match the cyan instead?
5. **Extended city style:** wireframe (current) or solid white blocks like the reference stills?
6. **Source code:** is the wirecable-showcase repo available? Its shaders could improve the flame and smoke.

## Known issues and limitations

- **The city wire is drawn on top of the city.** It renders after the bloom pass so it stays crisp, so buildings can't occlude it.
  - Current workaround: the avenue and the patch on its near side that the camera crosses (`approachPath`) are kept free of buildings, which reads as open ground in the wide view.
  - Proper fix: render the wire inside the city pass with a selective-bloom setup.
- **Legend aliasing:** at a distance the city wire's printed legend can shimmer into white specks. Possible fixes: a mip bias, fading the legend with distance, or a lower-contrast legend for the city wire.
- **Not tested on real devices**, especially phones. All checks so far are headless Chrome screenshots (REA) at 1440×900, 1200×750 and 390×844.
- **Performance:**
  - Two WebGL contexts, bloom on the city, and a CPU rebuild of the wire geometry per scroll tick.
  - Should be profiled on mid-range Android and iOS.
  - Consider a lower pixel ratio or no bloom on low-end GPUs.
- **Unused media** (`hero-day-night*.mp4`, `hero-night.jpg`) still ships in `dist/`.
- **Static fallback** (reduced motion / no WebGL) is functional but plain. It has no chapter visuals, only the day image and the copy.
- **Labels** in the strands chapter are positioned from 3D points and can overlap the copy on very short viewports.

## Pre-launch checklist

- [ ] Replace placeholder specs, legend, logo, font, favicon, contact address
- [ ] Decide the finale; build it
- [ ] Remove unused media from `public/media/`
- [ ] Real-device testing: iPhone Safari, Android Chrome, low-end laptop
- [ ] Performance profiling; adaptive quality if needed
- [ ] Accessibility pass: screen-reader order of chapter copy, focus states, contrast on every background tint
- [ ] SEO: title, description, Open Graph image (a still of the wireframe city or the wire)
- [ ] Analytics
- [ ] Deployment target and caching (the 3D chunk is about 146 KB gzipped)
- [ ] Remove or keep the dev-only `?at=` jump (it's compiled out of production builds already)
