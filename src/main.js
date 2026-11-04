import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TOTAL_SCREENS, local, smooth, windowed, lerp, progressOf } from "./story/timeline.js";
import { pageColors } from "./story/palette.js";
import { CHAPTERS, LABELS, GAUGE } from "./story/chapters.js";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ mobile menu */
const nav = document.querySelector(".primary-nav");
const toggle = document.querySelector(".menu-toggle");
toggle.addEventListener("click", () => {
  const open = !nav.classList.contains("is-open");
  nav.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.querySelector(".menu-toggle__label").textContent = open ? "Close" : "Menu";
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("is-open")) { toggle.click(); toggle.focus(); }
});

/* ------------------------------------------------------------------ chapter copy, labels */
const copyEl = document.querySelector(".story__copy");
const chapterEls = CHAPTERS.map((c) => {
  const el = document.createElement("article");
  el.className = "chapter";
  el.innerHTML = `<h2 class="chapter__title">${c.title}</h2><p class="chapter__body">${c.body}</p>${c.proof ? `<p class="chapter__proof">${c.proof}</p>` : ""}`;
  copyEl.append(el);
  return { ...c, el };
});
const labelsEl = document.querySelector(".story__labels");
const labelEls = Object.fromEntries(LABELS.map((l) => {
  const el = document.createElement("div");
  el.className = "label";
  el.innerHTML = `<span class="label__pin"></span><span class="label__tag"><span class="label__k">${l.k}</span><span class="label__v">${l.v}</span></span>`;
  labelsEl.append(el);
  return [l.id, el];
}));
const gauge = {
  el: document.querySelector(".gauge"),
  n: document.querySelector(".gauge__n"),
  fill: document.querySelector(".gauge__fill"),
};
for (const t of document.querySelectorAll(".gauge__tick"))
  t.style.left = `${((+t.dataset.at - GAUGE.from) / (GAUGE.to - GAUGE.from)) * 100}%`;

/* ------------------------------------------------------------------ static fallback (reduced motion, or no WebGL) */
const storyEl = document.querySelector(".story");
function goStatic() {
  storyEl.classList.add("is-static");
  root.classList.add("is-static");
  const copy = document.querySelector(".hero__copy");
  const fit = () => root.style.setProperty("--hero-copy-h", `${copy.offsetHeight}px`);
  fit(); window.addEventListener("resize", fit); document.fonts?.ready.then(fit);
  root.style.removeProperty("--story-screens");
  for (const c of chapterEls) { c.el.style.opacity = ""; c.el.style.translate = ""; }
}

if (reduceMotion) {
  goStatic();
} else {
  runStory();
}

function runStory() {
  root.style.setProperty("--story-screens", String(TOTAL_SCREENS + 1));

  /* page-load moment (once) */
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .from(".site-header", { autoAlpha: 0, y: -8, duration: 0.6 })
    .from(".hero__title .line__inner", { yPercent: 105, duration: 1.0, stagger: 0.1 }, 0.1)
    .from(".hero__lede, .hero__cta", { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.08 }, 0.3)
    .from(".hero__stage", { autoAlpha: 0, duration: 1.2, ease: "power2.out" }, 0.15);   // opacity only: scene.js measures this box

  /* the hero is the day render, held still; the first scroll turns it into the wireframe */
  const dayImage = document.querySelector(".hero__poster");
  const heroStage = document.querySelector(".hero__stage");
  const heroCopy = document.querySelector(".hero__copy");
  const canvas = document.querySelector(".story__canvas");
  const wireCanvas = document.querySelector(".story__canvas--wire");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  /* 3D: loaded after first paint, so the hero never waits for it */
  let story = null;
  const load = () => import("./story/scene.js").then(({ createStory }) => {
    try {
      story = createStory({ canvas, wireCanvas, stage: heroStage, media: dayImage });
      render(state.p);
    } catch (err) {
      console.warn("3D unavailable, showing the static story", err);
      goStatic();
    }
  });
  if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 1500 }); else setTimeout(load, 300);

  const state = { p: 0 };
  let lastBg = "";

  /* ---------------------------------------------------------------- the frame
     The city layer is full screen. At rest it is clipped to a frame under the headline (equal
     side margins on the page grid, running to the bottom of the viewport) and the image is scaled and
     moved so the crown tower sits in the middle of that frame. "open" eases both to identity, so the
     wireframe hand-over (scene.js) always meets the full-screen cover image it is aligned to. */
  const CROWN = { x: 0.5, top: 0.115 };  // crown tower: centre line and the top of its star, in the 16:9 render
  let frame = null;
  function layoutFrame() {
    const sw = heroStage.clientWidth, sh = heroStage.clientHeight;
    const heroStyle = getComputedStyle(heroCopy);
    const margin = sw >= 1024 ? Math.max(16, (sw - (sh - 112) * 1696 / 1024) / 2) : 16;
    const copyBottom = heroCopy.offsetTop + heroCopy.offsetHeight;        // layout box: ignores the scroll lift
    const gap = parseFloat(heroStyle.getPropertyValue("--hero-media-gap")) * parseFloat(getComputedStyle(root).fontSize);
    const top = Math.min(copyBottom + gap, Math.max(copyBottom + 24, sh - 120));                     // keep a usable frame on short screens
    const F = { l: margin, t: top, r: sw - margin, b: sh };                // runs to the bottom of the viewport
    // the image's cover box inside the full-screen layer, at its object-position
    const [opx, opy] = getComputedStyle(dayImage).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const k = Math.max(sw / 1920, sh / 1080), dw = 1920 * k, dh = 1080 * k;
    const cx = (sw - dw) * opx + CROWN.x * dw, cTop = (sh - dh) * opy + CROWN.top * dh;
    // smallest scale at which the (scaled) layer still covers the frame; the crown is centred
    // across it with its whole star inside the top edge (the front towers already hide its base)
    const fw = F.r - F.l, fh = F.b - F.t;
    const s0 = Math.min(1, Math.max(fw / sw, fh / sh));
    const pad = Math.max(20, fh * 0.07);
    let tx = (F.l + fw / 2) - s0 * cx, ty = (F.t + pad) - s0 * cTop;
    tx = Math.min(F.l, Math.max(F.r - s0 * sw, tx));
    ty = Math.min(F.t, Math.max(F.b - s0 * sh, ty));
    frame = { sw, sh, F, s0, tx, ty };
  }
  function setFrame(k) {     // k: 0 = framed, 1 = full screen
    if (!frame) layoutFrame();
    const { sw, sh, F, s0, tx, ty } = frame, u = 1 - k;
    heroStage.style.clipPath = `inset(${(F.t * u).toFixed(2)}px ${((sw - F.r) * u).toFixed(2)}px ${((sh - F.b) * u).toFixed(2)}px ${(F.l * u).toFixed(2)}px)`;
    const sc = lerp(s0, 1, k);
    const tf = `translate3d(${(tx * u).toFixed(2)}px, ${(ty * u).toFixed(2)}px, 0) scale(${sc.toFixed(5)})`;
    dayImage.style.transform = tf;
    if (traffic) traffic.style.transform = tf;
  }

  /* ---------------------------------------------------------------- the traffic loop
     Cars driving the streets (art/blender/animate_city.py). Same camera and city as the poster, and
     its first frame is the poster, so it simply fades in over it. Loaded after first paint, skipped on
     Save-Data, and played only while the city is on screen (paused once the wireframe takes over). */
  const traffic = navigator.connection?.saveData ? null : document.querySelector(".hero__video");
  let trafficWanted = false;
  if (traffic) {
    traffic.addEventListener("playing", () => traffic.classList.add("is-ready"), { once: true });
    const start = () => { traffic.preload = "auto"; setTraffic(trafficWanted); };
    window.addEventListener("load", () => setTimeout(start, 200), { once: true });
    document.addEventListener("visibilitychange", () => setTraffic(trafficWanted));
  }
  function setTraffic(on) {
    trafficWanted = on;
    if (!traffic || traffic.preload !== "auto") return;
    if (on && !document.hidden) traffic.play().catch(() => {});   // autoplay refused: the poster stays
    else traffic.pause();
  }

  function render(p) {
    const { bg, ink, dark } = pageColors(p);
    if (bg !== lastBg) {
      root.style.setProperty("--bg", bg);
      root.style.setProperty("--ink", ink);
      themeMeta.setAttribute("content", bg);
      lastBg = bg;
    }
    root.classList.toggle("is-dark", dark);

    // the framed city opens to the full screen while the headline lifts away; then it holds, immersive
    const open = local(p, "open");
    // the copy is gone before the frame's top edge reaches it, so nothing ever sits over the words
    setFrame(smooth(0.14, 0.85, open));
    const lift = smooth(0.0, 0.2, open);
    heroCopy.style.opacity = String(1 - lift);
    heroCopy.style.translate = `0 ${(-lift * 24).toFixed(1)}px`;
    heroCopy.style.visibility = lift >= 1 ? "hidden" : "";

    // the day render hands over to the 3D wireframe: the canvas (page colour + lines drawn exactly on
    // the render's edges) fades in over it while the page darkens to the warm night
    const wireOn = local(p, "wireOn");
    heroStage.style.opacity = String(1 - smooth(0.3, 0.6, wireOn));
    heroStage.style.visibility = wireOn >= 1 ? "hidden" : "";
    if ((wireOn < 1) !== trafficWanted) setTraffic(wireOn < 1);
    canvas.style.opacity = String(smooth(0.1, 0.42, wireOn));
    // hand-over: the product wire's canvas fades in over an identical frame of the city wire
    const wireIn = local(p, "wireIn");
    wireCanvas.style.opacity = String(smooth(0, 0.4, wireIn));
    wireCanvas.style.visibility = wireIn > 0 ? "visible" : "hidden";
    canvas.style.visibility = wireIn >= 0.5 ? "hidden" : "";

    // chapter copy
    for (const c of chapterEls) {
      const t = local(p, c.id);
      const a = c.id === "finale" ? smooth(0.42, 0.62, t) : windowed(t, 0.08, 0.24, 0.8, 0.94);
      c.el.style.opacity = a.toFixed(3);
      c.el.style.translate = `0 ${((1 - smooth(0.08, 0.3, t)) * 18).toFixed(1)}px`;
      c.el.style.visibility = a > 0.001 ? "visible" : "hidden";
    }

    let anchors = null;
    if (story) anchors = story.update(p, { bg }).anchors;

    // labels pinned to the wire
    const la = windowed(local(p, "strands"), 0.36, 0.5, 0.76, 0.88);
    labelsEl.style.opacity = la.toFixed(3);
    labelsEl.style.visibility = la > 0.001 && anchors ? "visible" : "hidden";
    if (anchors && la > 0.001) for (const id in labelEls) {
      const a = anchors[id];
      labelEls[id].style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    }

    // temperature gauge
    const h = local(p, "heat");
    const ga = windowed(h, 0.3, 0.42, 0.86, 0.96);
    gauge.el.style.opacity = ga.toFixed(3);
    gauge.el.style.visibility = ga > 0.001 ? "visible" : "hidden";
    const temp = lerp(GAUGE.from, GAUGE.rated, smooth(0.34, 0.78, h));
    gauge.n.textContent = String(Math.round(temp));
    gauge.fill.style.transform = `scaleX(${((temp - GAUGE.from) / (GAUGE.to - GAUGE.from)).toFixed(3)})`;
    gauge.el.classList.toggle("is-past", temp > GAUGE.ordinary);
  }

  gsap.to(state, {
    p: 1,
    ease: "none",
    onUpdate: () => render(state.p),
    scrollTrigger: {
      trigger: storyEl,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,            // smooths wheel steps into continuous motion
    },
  });

  window.addEventListener("resize", () => { layoutFrame(); story?.resize(); render(state.p); });
  document.fonts?.ready.then(() => { layoutFrame(); render(state.p); });   // the copy's height depends on the web font
  render(0);

  // dev only: ?at=segment:t jumps to a moment in the story (e.g. ?at=heat:0.6) for review
  if (import.meta.env.DEV) {
    const at = new URLSearchParams(location.search).get("at");
    if (at) {
      const [id, t] = at.split(":");
      const p = progressOf(id, parseFloat(t || "0"));
      const st = ScrollTrigger.getAll()[0];
      requestAnimationFrame(() => window.scrollTo(0, st.start + (st.end - st.start) * p));
    }
  }
}
