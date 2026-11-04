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
    .from(".hero__stage", { autoAlpha: 0, duration: 1.2, ease: "power2.out" }, 0);

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

  function render(p) {
    const { bg, ink, dark } = pageColors(p);
    if (bg !== lastBg) {
      root.style.setProperty("--bg", bg);
      root.style.setProperty("--ink", ink);
      themeMeta.setAttribute("content", bg);
      lastBg = bg;
    }
    root.classList.toggle("is-dark", dark);

    // the day render hands over to the 3D wireframe: the canvas (page colour + lines drawn exactly on
    // the render's edges) fades in over it while the page darkens to navy
    const wireOn = local(p, "wireOn");
    heroStage.style.opacity = String(1 - smooth(0.3, 0.6, wireOn));
    heroStage.style.visibility = wireOn >= 1 ? "hidden" : "";
    canvas.style.opacity = String(smooth(0.1, 0.42, wireOn));
    // hand-over: the product wire's canvas fades in over an identical frame of the city wire
    const wireIn = local(p, "wireIn");
    wireCanvas.style.opacity = String(smooth(0, 0.4, wireIn));
    wireCanvas.style.visibility = wireIn > 0 ? "visible" : "hidden";
    canvas.style.visibility = wireIn >= 0.5 ? "hidden" : "";

    // the headline clears the lower-left before the wire comes through
    const run = local(p, "run");
    heroCopy.style.opacity = String(1 - smooth(0.0, 0.22, run));
    heroCopy.style.translate = `0 ${(-smooth(0.0, 0.22, run) * 24).toFixed(1)}px`;

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

  window.addEventListener("resize", () => { story?.resize(); render(state.p); });
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
