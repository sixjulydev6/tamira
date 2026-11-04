# Tamira city hero — production prompt and implementation plan

## Task and scope

Rebuild the material, lighting and finish of Tamira’s existing city hero to match the supplied clay/ceramic references. Preserve the first screenshot’s city identity and its relationship to the website. Deliver an editable Blender source scene, a reproducible build/render script, finished responsive hero images, and a verified integration with the existing Three.js scroll story. This document is the implementation brief; writing it does not mean those assets have already been produced.

Do not redesign the whole website, replace the stack, or replace the orange crown tower with one of the reference buildings. The other supplied images establish finish and lighting quality, not a new architectural brief.

## Reference reading

Treat the supplied images in this order:

- **Image 1: composition and identity.** White city, dominant orange crown tower, elevated oblique view, quiet white website, black headline toward the lower left. The crown silhouette and window rhythm are essential. The broad white fade in the screenshot is page presentation, not evidence that the underlying materials should look washed out.
- **Image 2: dense city material and light.** Orange tower against neutral buildings, clear distinction between illuminated and shaded faces, grounded streets, warm light accents, selective depth of field. Preserve the density without reproducing blur across the main subject.
- **Image 3: edge and highlight quality.** Rounded building corners catch continuous highlights; orange painted surfaces have a broad satin response; shadows have direction and a readable penumbra. The train and elevated track illustrate material contrast; they are not required objects for Tamira.
- **Image 4: close material benchmark.** Orange bands have real thickness and rounded edges. Windows sit slightly below or above the facade rather than appearing as flat printed squares. Neutral buildings retain white highlights and cool grey shadow faces. Contact shadows make the floating emblem and building bases legible.

These are visual observations, not measured shader values. The images cannot reveal exact roughness, light power, camera optics or rendering engine. All numerical settings below are starting points to tune against rendered comparisons.

### What creates the quality

The target is an architectural miniature made from satin ceramic, dense resin or carefully coated clay. It is not chalk, unfinished concrete, gummy wax, polished plastic or wet porcelain.

The quality comes from five cooperating systems: bevel geometry, smooth but controlled normals, moderately rough dielectric materials, directional studio lighting with restrained fill, and a color pipeline that protects highlights without flattening shadows. Fine texture is subordinate. HDR lighting means a useful range of scene luminance, not a bloom filter or an HDR display requirement.

### Current asset assessment

`public/media/hero-day.jpg` was inspected directly. It already carries the correct crown, city density and orange/white hierarchy. Its broad softness, pale face separation and limited edge highlights make it less tactile than the closer reference views. The first experiment should change bevels, lighting and focus while keeping layout fixed; adding more buildings is not the first fix.

## Architecture decision

Blender, GLB and Three.js are different layers, not interchangeable choices.

| Approach | Quality and cost | Decision |
| --- | --- | --- |
| Blender source + Cycles render served as an image | Highest control over soft light, bounce, contact and focus; low runtime cost; fixed view | Primary opening hero |
| Blender-authored optimized GLB + Three.js lighting | Supports camera movement and live relighting; requires a separate runtime look-development pass | Use where the existing story needs solid geometry or camera motion |
| Entire city procedurally authored in Three.js | Technically capable, but requires equivalent geometry, lighting and art direction work in code | Keep for existing wireframe/extension; do not rebuild the hero this way by default |
| Prerendered full animation | Consistent offline lighting but heavier delivery and poor arbitrary scroll seeking | Do not introduce unless an approved camera sequence requires it |

**Recommended pipeline:** editable `.blend` + deterministic scene data → Cycles hero stills and matching transition metadata → optional runtime GLB → existing Three.js/GSAP story.

A `.blend` is the source of truth for look development. It is not a browser asset. A `.glb` transports geometry and supported PBR materials; it does not reproduce a Cycles render automatically. Blender area/world lighting is not carried by the standard exporter as the complete studio setup. Procedural shading must be translated or baked where needed. Rebuild runtime illumination explicitly.

Do not promise identical realtime and offline results. If the hero is static, use the render. If an interactive solid city is later required, validate one building and the crown in Three.js before exporting the whole city.

## Existing project constraints

Read `docs/ARCHITECTURE.md`, `docs/STORY.md`, `docs/DESIGN-SYSTEM.md`, `docs/REFERENCES-AND-ASSETS.md` and `docs/OPEN-ITEMS.md` before implementation.

Verified repository structure:

- Vite 5.4.10, vanilla JavaScript, Three.js 0.170.0 and GSAP 3.12.5. Keep these unless a specific incompatibility requires a change.
- `src/main.js` drives scroll, poster/canvas blending and fallback behavior.
- `src/story/city.js` holds the city layout, crown, roads and the avenue. Its world convention is Z up, in metres.
- `src/story/scene.js` holds camera poses, two renderers and city-to-product handover.
- `src/story/timeline.js` defines story segments. Preserve chapter order and progress semantics.
- `src/story/palette.js` and `src/style.css` control page color and framing.
- The opening image is aligned to the procedural city. Existing docs describe a 38° elevation, −45° azimuth and 400 m horizontal frame width.
- Current city shaders are intentionally unlit. Changing their roughness cannot create a clay daylight renderer.
- Existing docs describe an external `hero_day.py` Blender source. The documented local path was not present when this brief was written. Locate it if available; otherwise reconstruct from the in-repo deterministic geometry. Do not assume source access.

Do not edit someone else’s live Blender scene. If using the shared render machine described in the repository docs, use a separate background process and its designated Tamira output directory.

## Art direction using design-taste-frontend

This is a single hero asset within an existing direction, so use the skill’s single-section exception: preserve surrounding type, palette and composition rather than drawing a new page direction. No random direction or seed was generated for this planning task.

Subject inventory, grounded in the supplied visuals and repository: Tamira wordmark; orange six-arm crown; central tower’s recessed opening; white windowed blocks; charcoal roof planes; compact city streets; miniature trees; the clear avenue; cable replacing the reference train’s movement; daylight-to-wireframe reveal. These are available motifs, not claims of unique real-world brand ownership.

**Idea:** On this page, Tamira’s crown-shaped tower becomes the focal point of a miniature city whose hidden wiring is revealed by scroll.

**Argument:** the opening establishes the city and crown; the aligned wireframe reveals structure; the avenue and cable connect the city to the existing product story. Preserve that visual continuity instead of inserting a disconnected decorative model.

**One live thing:** retain the existing scroll-controlled reveal and cable journey. Do not add orbit controls, a second interaction or an unrelated material selector.

Keep a flat white page, black text and existing red brand accent. The orange physical material belongs to the scene. The skill’s bans on UI shadows, gradients and glows must not remove physically necessary shadows or shading from this 3D artwork; the user explicitly requires them. Avoid fake CSS shadows behind the hero, glass panels, new badges and decorative labels. Do not add extra images or entrance animations just to satisfy full-page counts in a single-asset task.

## Production sequence

### Establish a reproducible baseline

1. Record repository status and preserve unrelated changes.
2. Run the existing site and capture 1440×900, 768×1024 and 390×844 views, including `?at=day:0.5`, `?at=wireOn:0.4` and `?at=wireOn:0.95` in development.
3. Capture the raw existing image alongside the composed hero. Separate lighting problems from CSS masking problems.
4. Locate Blender source and reference files. Record Blender version, renderer, color settings, seeds and output paths. If the supplied chat references are unavailable as local files, preserve this written analysis and request the originals only when actual image comparison requires them.
5. Export or reconstruct a shared city manifest containing stable building IDs, transforms, dimensions, crown outline, road paths, camera and anchors. Do not maintain independently hand-tuned city layouts.

### Lock geometry and composition

Start with the current layout and camera. The hero tower remains tallest and visually dominant; foreground buildings must not hide its recognizable upper silhouette. Keep windows regular and subordinate. Keep the avenue clear for the cable sequence.

Model the crown as the existing six-arm notched extrusion around a central opening. Do not substitute a generic cylinder, star or flower. Use physically thick surfaces and resolve overlaps at arm junctions. Bevel edges without rounding away its identity.

Suggested bevel starts, relative to each building’s width:

- Main facade edges: 0.4–1.0% of width, 3–5 segments.
- Crown: 0.2–0.5% of crown diameter; inspect the notches and opening at final size.
- Window edges: narrow bevel only, with shallow recess or restrained raised insets.
- Roof slabs: real thickness and a narrow rounded edge.

Apply scale before beveling. Keep broad facade faces planar; use controlled smooth shading and weighted/custom normals where supported. Avoid inflated corners, shading dents and excessive subdivision. Inspect silhouette and normals before texturing.

For medium and far windows use instancing, atlas relief or normal maps. Do not create thousands of independent window materials. Keep trees as simple rounded miniature forms and vehicles subordinate. Do not add a train, repeated floating emblems or orange bands simply because they occur in the quality references.

### Material look development

Build a test scene with one white block, one orange block, a charcoal roof and the actual crown detail. Approve their finish before rendering the full city.

| Material | Suggested starting values | Desired reading |
| --- | --- | --- |
| Neutral city | Base color around `#E5E5E1`, metallic 0, roughness 0.40–0.55, IOR about 1.45–1.50 | White satin ceramic with broad highlights |
| Crown orange | Start around `#E85C2D`, metallic 0, roughness 0.32–0.45, IOR about 1.46 | Saturated coated clay, orange in light and shadow |
| Ground | Near-neutral `#E8E9E7`, metallic 0, roughness 0.65–0.80 | Quiet matte support with visible contact |
| Roofs/windows | Neutral charcoal/grey, metallic 0, roughness 0.35–0.55 | Restrained contrast, no black voids |
| Trees | Same neutral material family, roughness 0.50–0.65 | Rounded miniature forms, not foliage realism |

These hex colors are display-space swatches, not measured physical reflectances. Judge them under the approved exposure. Do not force a lit white surface to equal the input swatch.

Keep coat at zero initially; test a small amount only if bevel highlights remain too dull after lighting is correct. Leave transmission and subsurface off initially. Clay style does not require translucency. Use subtle roughness variation of roughly ±0.02–0.04 and very low normal relief only if visible in the close reference comparison. At hero scale the surfaces should read almost smooth. No grunge, pores, fingerprints, heavy concrete noise or metallic orange.

### Lighting

Use Cycles for the approved still.

- Place a dominant area key above and to camera-left. Rotate it until the scene’s cast shadows agree with the reference direction rather than applying the same arbitrary world rotation to every setup.
- Start with the key’s apparent size around half to one tower width from the subject’s perspective. Adjust source size/distance to create coherent broad-edged shadows, not ambient mush.
- Use a weak neutral/cool world or large fill, initially about 20–35% of the key’s contribution at the subject. This is a visual ratio, not a universal watt setting.
- Add a restrained large rim only if it improves edge separation without creating a second competing shadow direction.
- Use bounce lighting for local orange spill. Do not add an orange emissive fog layer around every building.
- Keep the white city bright while retaining readable shaded faces and tight base contact. Contact shadows should be darkest at contact and soften away.

Debug with clay override and no bloom. If the result is flat, reduce fill before lowering roughness. If it looks plastic, increase roughness or broaden the reflection source before adding texture. If corners remain invisible, inspect bevel geometry and normals.

### Camera, focus and image finish

Use orthographic projection for the locked opening composition. Treat the documented 400 m as horizontal world coverage; Blender orthographic scale and Three.js frustum must be derived from aspect ratio and checked by projection, not equated blindly.

Set focus so crown top, primary orange facade and nearby buildings remain readable together. Initially disable depth of field; introduce only enough to soften distant edges after materials are approved. Do not blur away the bevels that establish quality. Orthographic focus behavior must be tested in the installed Blender version; do not assign an f-stop without checking its result.

Render at 2560×1440 or larger for desktop master, with separate portrait framing for mobile. Use 256–512 samples as an initial final-render range, adaptive sampling and denoising; increase only if visible noise remains. Preserve a linear EXR master and a display-referred PNG master. Record the exact view transform and exposure; choose AgX or the installed equivalent deliberately. Avoid crushed blacks, clipped white facades, excessive contrast and indiscriminate sharpening.

Deliver an unmasked beauty render. Evaluate the existing CSS fade separately. Limit fading to the copy-side/perimeter needed for integration; never wash out the crown’s key face to hide a compositing mismatch.

## GLB and realtime branch

Only build this branch for actual runtime geometry requirements. The recommended static hero does not depend on loading a GLB.

- Export applied bevel geometry, correct normals, supported PBR materials and named anchors. Convert procedural noise to textures where needed. Keep reusable building modules instanceable.
- Handle Blender Z-up to glTF Y-up explicitly. Either adapt the imported root once to the existing Z-up story or migrate every dependent camera/path together. Do not double-convert axes.
- Keep animated cable and lit windows separate from static baked content. Never bake a temporary light state into a surface expected to switch state later.
- Choose one lighting strategy per material: live PBR plus AO/indirect support, or fully baked unlit appearance for fixed illumination. Do not bake direct shadows into base color and add the same direct light again.
- A full lightmap may need explicit Three.js UV/material wiring; verify loader behavior for the pinned r170 version. Do not assume arbitrary Blender lightmap nodes export.
- Rebuild environment illumination with PMREM and appropriate runtime lights. Test directional shadow maps or baked static shadows; standard area lights do not automatically reproduce Cycles shadowing.
- Use `GLTFLoader` from the installed Three.js addons. Add mesh compression and KTX2 only after proving the uncompressed asset is correct and configuring matching decoders.
- Keep sRGB color textures and linear data textures distinct. Do not double-convert `THREE.Color` values. Use one final output transform; do not apply display conversion twice in a composer.
- Existing city bloom uses a different pipeline from product rendering. Introduce a separately controlled daylight PBR pass if necessary; do not globally change tone mapping and break wireframe/product chapters.

Proposed targets, to measure rather than claim: runtime city under 200k visible triangles and 100 draw calls; GLB plus textures under 5 MB transferred; desktop poster under 500 KB, mobile under 250 KB at acceptable quality; DPR capped at 1.5 initially. Favor the poster on weak devices. Profile actual frame time on representative devices before enabling extra passes.

## Poster-to-city continuity

This is a release gate, not a finishing detail.

Export a manifest with camera position, target, up axis, projection, horizontal/vertical frame bounds, aspect, render dimensions, crop, stable building transforms and key anchors. Include crown top, crown base and at least four surrounding roof corners.

Fit both image and canvas using identical crop rules. Account for `object-fit`, `object-position`, canvas viewport, CSS mask and device aspect ratio. Retain the existing view-offset alignment logic where correct. If geometry changes, update both solid render and wireframe data from the manifest.

Use a 50% overlay or difference image to compare projected anchors. Target no visible jump and approximately 2 CSS pixels or less anchor deviation at each test viewport. Compare with DOF off when checking geometry. An opacity crossfade is not a fix for a misaligned camera.

Keep the existing `day → wireOn → extend → run → approach → drain → wireIn` sequence. Preserve the product handover transform and cable stop position. The current cable-over-city pass has a documented occlusion limitation: keep the clear route or implement shared depth/selective bloom before moving buildings into its path.

## Website integration and resilience

Use responsive `<picture>` sources with explicit dimensions and a stable aspect box. Preserve the existing JPG until replacement outputs pass comparison. Show the opening image immediately; lazy-load runtime 3D after first paint. Do not hide the hero while waiting for a GLB or decoder.

On mobile, reframe the city so the crown survives and the headline occupies a dedicated readable area. Do not simply crop desktop center and hope. Preserve current copy by default; any shortening needed to satisfy the skill’s two-line headline rule must be an explicit copy proposal, not a silent rewrite.

Keep text selectable in HTML. Give meaningful image alt text or use empty alt when equivalent adjacent content fully covers its purpose. Preserve keyboard navigation, reduced-motion static layout, no-WebGL fallback and context-loss behavior. Keep navigation/contact targets as they currently work; report placeholder destinations rather than inventing brand contact details.

## Deliverables

Proposed paths, not claims that these files already exist:

- `art/blender/tamira-city.blend`: organized source with named collections, cameras and materials.
- `art/blender/build_city.py`: deterministic generation and rendering, documented invocation and version.
- `art/data/city-layout.json`: shared geometry/anchor manifest and coordinate conventions.
- `art/renders/`: lossless masters, material closeups and comparison sheets; keep large masters out of runtime assets.
- `public/media/hero-city-desktop.avif`, `.webp`, mobile equivalents and compatible fallback.
- `public/models/tamira-city.glb` and texture/decoder assets only if the runtime branch is used.
- Focused changes to existing source files; update architecture and asset documentation to match the final implementation.
- A validation report with screenshots, file sizes, render settings, remaining mismatches and measured runtime performance.

## Acceptance checklist

- Crown silhouette, opening and six-arm profile match the existing hero.
- Orange reads as satin coated clay; neutral city reads as ceramic rather than white cardboard.
- Bevel highlights are visible at actual CSS display size, not only in a zoomed render.
- Light/shadow faces are distinct; ground contact remains readable; highlights retain detail.
- Crown remains sharp enough to recognize; DOF does not hide material quality.
- No excessive bloom, glow halos, heavy texture, unrealistic mirror reflections or glossy wet surfaces.
- Main visual and copy coexist without collisions at 1440, 768 and 390 px widths, including short viewport heights.
- Before/after transition overlays show no visible crown, road or roof jump.
- All existing scroll chapters, reverse scrolling, resize behavior and static fallbacks continue to work.
- Run `npm run build`; inspect browser errors and missing assets. A passing build alone is not visual validation.
- During implementation, use the design-taste skill’s lint/inspection tools for the changed section and review the screenshots directly. Document full-page findings outside scope rather than claiming global compliance. No inspection or performance score has been run for this planning-only deliverable.

Review three crops before final rendering: crown notch closeup, white roof/window closeup and ground contact shadow. Then review the whole hero in the actual page. Fix the three largest visible mismatches and repeat, up to three deliberate review rounds. Do not claim a reference match from code settings alone.

## Technical sources and limits

Consult the installed Three.js r170 code before using APIs shown in newer documentation.

- [Three.js color management](https://threejs.org/manual/pages/color-management.html): linear working space, color texture handling and output conversion.
- [Blender glTF exporter](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html): material translation and export limitations, including area/world lighting.
- [Three.js glTF loading](https://threejs.org/manual/pages/load-gltf.html): runtime asset loading workflow.

The architectural recommendation is an engineering judgment based on the existing implementation and the supplied visual target. Material values, performance budgets and render settings are proposed starting points. Exact reference settings, external Blender source availability and real-device performance remain unverified.
