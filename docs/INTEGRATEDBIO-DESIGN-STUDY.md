# Integrated Biosciences design study

Studied 2026-11-04. Reference: [Integrated Biosciences](https://integratedbio.com/?ref=navbar.gallery). Research only: no Tamira UI, assets, layout or animation changed. This reference does not supersede the current Tamira direction.

## Scope and method

Used the requested REA skill for static analysis of downloaded public JavaScript and design-taste-frontend for the composition, type, palette, imagery and interaction reading. No direction draw or redesign was appropriate: this is an existing reference to understand, not a new design to generate. The skill's house rules are a comparison lens, not instructions to alter this site.

Comet supplied the visible desktop hero, accessibility structure and a live 440×956 phone typography measurement. Public HTML/CSS and page-specific scripts supplied precise declared values and the broader page structure. Normal browser scrolling through the native tool was unreliable; subsequent device-emulation/resize state did not produce a trustworthy full-page desktop review. Do not mistake those partial captures for intended responsive layouts. Complete mobile, hover, reduced-motion and all-page visual verification remain incomplete. No inspector score or accessibility/performance pass is claimed.

Comet did not expose an existing CDP endpoint, so REA's passive browser tools could not attach. REA analyzed seven locally downloaded application scripts without executing them. Parent Evidence: `ev_df6fa68b8f7dae83f5ca9e849f3ef9c017fc5ea7cf8c8d97fc9ff653def9c210`; summary Evidence: `ev_0a60131fa38feea4d95e8306d15c79605da210ab56852452bb4b05fcb50f6670`. Coverage is partial: dependencies, dynamically resolved relationships and three unselected files were outside that analysis. These IDs are session evidence references, not durable public URLs. Temporary captured files and URL manifest: `/tmp/integratedbio-study/`; temporary files may be removed by the OS.

## Central design argument

The homepage presents a biotechnology company as a combination of living systems and deliberate engineering. The visual treatment suggests biology through soft, translucent, green macro forms; typography, alignment and compact controls supply the engineered precision. That is an interpretation of the design, not a statement from its creators.

Subject inventory behind the argument: aging biology, multimodal datasets, cellular models, whole-organism models, medicinal chemistry, small molecules, AI hypothesis generation, experimental validation, iterative feedback, scientific publications, and the research team. Those elements explain the content sequence more usefully than calling the site “clean” or “premium.”

The homepage's argument is: ambition → integrated discovery method → three platform capabilities → company and scientific provenance → research output → invitation to work together. The publications provide evidence after the large ambition statement.

## Hero composition

The hero is an almost viewport-filling media field with a narrow off-white surround. Its desktop composition is spatially separated into four anchors:

- Brand at upper left.
- Compact navigation/control group at upper right.
- Very large white headline aligned left below the brand.
- Supporting explanation at lower left, with the primary company action at lower right.

The headline is not centered and is not set inside a separate card. It occupies roughly a 1070px maximum measure; the screenshot shows two lines. The lower explanation and action are intentionally separated from the heading by the large media field. Their bottom alignment gives the screen a strong base. This is why moving the explanation directly under the heading would change the reference's composition even if every font were copied.

The image is the atmosphere and continuous field, rather than a discrete product object needing a camera orbit. Its defocused forms leave room for legible type. Large scale, left alignment, limited controls and a complete first-screen composition carry much of the effect.

### Declared dimensions versus observed measurements

Values below are shipped CSS declarations unless explicitly marked observed. They are not all computed-style measurements at the same viewport.

| Element | Reference values |
| --- | --- |
| Main content height | `100lvh`, column flex with `justify-content: space-between` |
| Media inset | 12px above 1024px; 8px at narrower widths |
| Media corner radius | 20px before opening scroll |
| Content width | 1524px maximum content plus responsive horizontal padding |
| Content padding | 24px small / 48px large |
| Main top padding | Fluid 112–148px |
| Main bottom padding | Fluid 32–44px |
| Headline | Aspekta 400; fluid 50–112px; line-height 1; tracking −0.03em; max-width 1070px |
| Supporting copy | Aspekta; fluid 20–24px; line-height 1.2; tracking −0.02em; max-width 640px |
| Main bottom row | Column with 24px gap on small screens; row aligned at bottom from 1025px |
| Phone measurement observed in Comet | At 440×956: headline 50px / 50px, 392px wide, Aspekta computed family |
| Desktop header | Fixed, top 30px, 54px height; shared content container |
| Mobile header | Fixed top 20px; 64px height; width `calc(100% - 40px)` |

The desktop hero visual was directly observed in Comet; the phone values were read through its console. Do not infer a complete 390px phone visual pass from the 440px measurement.

## Typography and palette

Two families do distinct work: **Aspekta** regular/semibold for the main content and **Roboto Mono** regular for navigation, action labels, indexes and metadata. Large type uses tight tracking and compact leading; the small controls are uppercase and relatively quiet. This establishes a scientific/editorial hierarchy with little need for extra type styles.

| Role | Shipped token |
| --- | --- |
| Main page ground | `#f7f7f5` |
| Main ink / dark action | `#222f30` |
| Green accent | `#a7e26e` |
| Light lime action accent | `#cef79e` |
| Supporting neutral fields | `#eeeeee`, `#e4e3e3` |
| Muted green/grey | `#c9cbbe`, `#445e5f` |
| Light alternate field | `#f5f8f7` |
| Hero type | White |

Most page surface is neutral. The video adds richer greens and warm translucent tones; lime concentrates attention on interactive details. The background motion is not evidence of a CSS gradient treatment.

## Header and actions

Desktop navigation contains two destination links and a stronger recruitment/contact action, within a small translucent light panel on the right. The logo remains independently placed on the left. The panel uses blur, a low-opacity border and rounded corners; the inner action is dark. On small screens, the design becomes one compact light header with a dark menu toggle. The source toggles `data-navigation-status` and applies scroll state after 10px.

The primary button is a custom two-part object: a dark text surface with a curved/slanted trailing edge and a separate lime arrow surface. It is 48px high, with 12–14px uppercase mono type. On hover, source rules swap color roles, move the arrow graphic and morph the adjoining SVG contours. MorphSVG uses a 0.3s `power2.out` tween; associated CSS transitions run 0.6s. This is a repeated brand detail rather than a generic rounded button. Runtime hover was not fully verified.

## Hero media and motion

The actual homepage hero markup declares an autoplay/muted/loop/playsinline MP4: `integrated-loop-optimized.mp4`. It is **not evidence of a live Three.js hero**. The page also declares a separate Unicorn Studio WebGL background elsewhere; do not conflate that with the hero video.

Source-derived choreography:

1. Wait for fonts, split headline and explanation into masked lines.
2. Move those lines from `y: 110` to 0 over 0.8s with `power2.out`, 0.05s line stagger. Headline and explanation begin together.
3. Bring the action from opacity 0, `y: 20`, scale 0.9 to its resting state over 0.6s, starting at 0.4s, using `back.out(1.7)`.
4. Over the initial scroll (`top top` to `bottom+=50px bottom`, scrub 1), reduce the media frame inset from 12/8px to zero and its 20px corner radius to zero. The contained scene opens into an edge-to-edge field.
5. Intersection handling swaps logo treatment and pauses/resumes the video as the hero leaves/enters view.

Lenis is connected to GSAP's ticker, with declared lerp 0.1 and duration 1.2. Desktop content reveals use 0.8s `power2.out`, 0.05s stagger and a `top 80%` trigger. Platform panels have clip reveals and delayed content entrances.

Important boundary: the hero script contains optional pinned scroller/progress/index logic, but this homepage's captured hero HTML contains **no `.hero_scroller`**. Its presence in the reusable script does not mean the homepage runs that multi-step scene. Likewise, source options do not prove every animation executes successfully. The hero background became black in one later Comet capture; the cause was not established.

## Whole homepage structure

| Section | Composition and purpose |
| --- | --- |
| Hero | Full-height moving media, left headline, bottom explanation/action; establishes ambition and subject |
| Platform introduction | Off-white editorial heading/copy; explains the integrated discovery method |
| Three platform capabilities | Contiguous desktop panels for datasets, drug design and AI; each has index, icon, title and supporting copy; stacked on small screens |
| Oversized moving statement | Marquee repeats the positioning phrase; changes rhythm and scale |
| Company introduction | Split editorial heading/label establishes scientific identity |
| Company media and text | Rounded image, large statement, narrower explanatory columns and company action; adds provenance |
| Newsroom | Rounded neutral field, publication imagery and article links; turns research claims into inspectable output |
| Footer | Large mission statement, recruitment action, navigation/social links, return-to-top control and wordmark close |

Neighbors alternate between immersive media, editorial text, contiguous color panels, moving type, split media/copy and article layout. The repetition is in type, color and controls; the section composition varies.

## Site information architecture

Shared navigation leads to three pages. HTML structure was inspected; their complete rendered desktop/mobile layouts were not reviewed.

- **Company:** smaller hero, full-screen media, research introduction, media with columns, team grid, team carousel/list, supporting logos and shared footer. Team biography modal markup is present.
- **Newsroom:** editorial hero, featured/archive block, long publication/article list, shared footer. External publication links provide a path to the underlying research.
- **Work with us:** contact/recruitment hero, full-screen media, invitation and form, shared footer. Its role combines recruitment and contact; it is broader than a jobs listing.

## Design-taste reading

The reference's strongest decisions are the dominant media field, decisive type scale, a clear visual frame, a coherent green/neutral world and an action shape repeated consistently. It has a composed opening and actual research content behind its claims.

It also deliberately uses devices the taste skill normally bans: mono uppercase metadata, a blurred floating navigation panel, eyebrow labels, numeric indexes, thin rules and repeated panels. This research request is to understand those decisions, not strip them out. Copying the ornaments without the large-scale composition and consistent image treatment would lose the reason the reference works.

The main tradeoff is the distance between headline and explanation. It creates a strong immersive poster but makes the first-screen meaning depend on visitors reading the lower edge. The macro imagery expresses a biological category rather than uniquely identifying this company's platform; publication/team content supplies specificity later. These are design interpretations, not measured conversion findings.

## Lessons to retain for later Tamira discussion

- Think in complete viewport compositions and repeated alignments before tuning decorative details.
- Separate the headline, explanation, navigation and action into deliberate spatial roles.
- One strong moving visual can do more than several simultaneous camera effects.
- Let materials/color express the subject; let the layout and controls provide precision.
- A distinctive action detail works because it recurs consistently.
- Study the frame-to-full-bleed opening as a simple composition change; do not assume the site needs an object orbit or a long pinned sequence.
- Retain Tamira's own city, wire, branding and accepted story unless a subsequent request changes them. No design migration is authorized by this study.

## Public source references

[Homepage](https://integratedbio.com/) · [Company](https://integratedbio.com/company/) · [Newsroom](https://integratedbio.com/newsroom/) · [Work with us](https://integratedbio.com/work-with-us/).

[Base CSS](https://integratedbio.com/wp-content/themes/integratedbio/dist/css/app-styles.css?ver=1792735684) · [Hero CSS](https://integratedbio.com/wp-content/themes/integratedbio/dist/css/blocks/hero-xl/hero-xl.css?ver=1792735690) · [Header CSS](https://integratedbio.com/wp-content/themes/integratedbio/dist/css/blocks/header/header.css?ver=1761140328) · [Hero JavaScript](https://integratedbio.com/wp-content/themes/integratedbio/dist/js/blocks/hero-xl/hero-xl.js?ver=1792735689) · [Application JavaScript](https://integratedbio.com/wp-content/themes/integratedbio/dist/js/app.js?ver=1792735688).
