# Incident.io hero layout implementation

Reference: https://incident.io/ — inspected November 4, 2026.

## Scope and direction

Applied the reference's centered hero, serif display scale, navigation arrangement, supporting-copy spacing, pill action and media framing to Tamira. Retained Tamira's copy, city artwork and scroll story. No announcement banner, demo/signup copy or reference product artwork was copied.

Used design-taste-frontend's single-section workflow: the user supplied the direction, so no random draw, seed or redraw was used. Idea: Tamira's crown city is the subject of the large media frame; scrolling reveals its wiring. The existing scroll sequence is the live interaction.

## Evidence and measurements

REA discovered the isolated reference page through CDP and performed passive inspection (evidence `ev_438ce1db8b1586fcb3ad868a0ab62944ad03ade1cb2afa6bc43d9f241757e464`). Its capture was attach-limited/policy-filtered. REA's scenario launch initially failed; a separate agent-browser session supplied the live computed styles and bounding rectangles below. Do not attribute those JavaScript measurements to passive REA.

| Desktop measurement | Reference | Tamira implementation |
| --- | --- | --- |
| Headline top | 214.39px | 214.39px |
| Headline measure | 794px | 794px |
| Headline size / leading | 80 / 80px | 80 / 80px |
| Tracking | −3.2px | −3.2px |
| Supporting copy top | 386.39px | 386.39px |
| Supporting copy size / leading | 24 / 31.2px | 24 / 31.2px |
| CTA top | 472.77px | 472.78px |
| CTA height | 49px | 49px |
| Media top at 1920×1080 | 609.77px | 610px |
| Media side inset at 1920×1080 | 158.38px | 158.38px |

Desktop headline-to-copy gap is 12px; copy-to-action gap is 24px. The large media starts 88px after the action. At phone/tablet widths the display is 44px / 48.4px, copy is 18px / 25.2px, side margins are 16px and media gap is 40px. Tamira has one relevant CTA, so no second button was invented.

### Font limitation

Reference fonts are STK Bureau Serif and STK Bureau Sans. Those font files are not in this repository. The implementation uses Geist Serif (Vercel, SIL OFL, self-hosted from `public/fonts/`; it replaced an interim Georgia) for the hero and retains Instrument Sans for supporting text/navigation and Quicksand for the existing wordmark. Consequently this is a match of layout measurements and font sizes, not an exact glyph match. To achieve identical letterforms, supply the corresponding licensed brand font assets and map `--font-hero` plus the hero/header sans styles to them. The action uses deeper Tamira red for white-text contrast rather than the reference's orange.

## Changes

- `src/style.css`: hero display family/size/tracking, measured text and action spacing, centered nav, quiet contact pill, header-specific width, responsive/static media spacing.
- `src/main.js`: opening media clip uses the reference's viewport-height-dependent width and an 88px desktop gap; expansion still reaches the original full-screen image before the wireframe handoff.
- Preserved the pre-existing uncommitted artwork, source and documentation changes found at task start. No 3D assets were regenerated in this task.

## Validation

- `npm run build` passes; Vite retains its existing large scene-chunk advisory.
- Browser checks at 1920×1080, 1440×900, 768×1024 and 390×844: no horizontal overflow, desktop position assertions passed, no captured JavaScript exceptions.
- Phone menu opens and closes with Escape. Reduced-motion static layout and `wireOn:0.95` captured successfully.
- Before/after design inspector reports and screenshots are in `.taste-skill/before-incident`, `.taste-skill/after-incident`, and `.taste-skill/after-incident-final`.
- Final inspector: 0 FAIL with explicit `few-pictures,headline-lines` allowances; 4 WARN. This is not an unconditional full-page pass.
- The one-image allowance reflects the requested single-hero scope; adding unrelated photos would change the brief. The phone three-line headline preserves the measured 44px reference scale and Tamira's existing copy. The reference itself has a three-line phone headline.
- Warnings: the third face is the retained brand wordmark; no footage is necessary for a live Three.js story; the inspector treats the full-screen clipped media element as overlapping despite visible clip separation; its DOM motion count does not describe movement within WebGL. Existing chapter/canvas composition remains outside the hero restyle.
- Source lint still flags existing label/menu shadows and an old comment phrase. They were not introduced by this restyle; the menu is a floating overlay. No broad lint cleanup was performed.

## Critique

ROUND 1
Seen in one second: A small centered sans headline with a city immediately beneath it.
Idea (one sentence): Tamira's crown city opens into its wiring story.
Live thing: Existing scroll reveal and cable journey.
Layout words by section: hero=centered copy then city / story=pinned city and product / contact=plain close.
Scores: design 6.0 · usability 7.0 · creativity 6.0 · content 6.0 → overall 6.3.
Caps applied: Existing single-picture page; assessment focuses on hero fit to reference.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Before desktop-fold: 56px sans display lacks the reference's 80px serif scale; replace the hero type treatment.
2. Before desktop-fold: heading starts near the header rather than y214px; use measured top spacing.
3. Before desktop-fold: media begins too early and too wide; fit its opening frame from the reference viewport geometry.

ROUND 2
Seen in one second: Large serif promise, one red action, crown city below.
Idea (one sentence): Tamira's crown city opens into its wiring story.
Live thing: Existing scroll reveal and cable journey.
Layout words by section: hero=centered display, support, action, city / story=existing pinned 3D / contact=existing plain close.
Scores: design 6.5 · usability 7.5 · creativity 6.0 · content 6.5 → overall 6.7.
Caps applied: Single-picture page and three-line phone headline cap design at 6.5 under the skill's full-page rubric; both are documented scope/reference choices.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Final desktop-fold: Georgia's glyphs differ from Bureau Serif; exact matching needs the original licensed font assets.
2. Final mobile-fold: the existing nine-word headline takes three lines at 44px; retained to match the requested reference scale, rather than silently rewriting copy.
3. Final story sheets: later wireframe bloom is stronger than the daylight hero; retained existing scene treatment, not part of this layout task.

No found imagery, font binaries or footage were added. Existing Tamira imagery remains the subject; existing placeholder brand/product/contact content remains documented in `OPEN-ITEMS.md`.
