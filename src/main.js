import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SEGMENTS, TOTAL_SCREENS, local, smooth, windowed, lerp, progressOf } from "./story/timeline.js";
import { createRoom } from "./story/room.js";
import { createLiveRoom } from "./story/room-live.js";

// The room at the end: the 48 rendered images on every device (user direction, DECISIONS 34: the live
// GLB room was breaking). ?room=glb opens the GLB room on desktop for development only.
const PHONE = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
const ROOM_MODE = !PHONE && new URLSearchParams(location.search).get("room") === "glb" ? "glb" : "images";
import { finaleU } from "./story/finale-timing.js";
import { pageColors } from "./story/palette.js";
import { CHAPTERS, LABELS, GAUGE } from "./story/chapters.js";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;

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
  if(l.id.startsWith('bundle'))el.classList.add('label--bundle');
  el.innerHTML = `<span class="label__pin"></span><span class="label__tag"><span class="label__k">${l.k}</span><span class="label__v">${l.v}</span></span>`;
  labelsEl.append(el);
  return [l.id, el];
}));
const bundleLeaders=document.createElementNS('http://www.w3.org/2000/svg','svg');
bundleLeaders.classList.add('bundle-leaders');bundleLeaders.setAttribute('aria-hidden','true');
const bundlePaths=Object.fromEntries(LABELS.filter(l=>l.id.startsWith('bundle')).map(l=>{
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');bundleLeaders.append(path);return [l.id,path];
}));
labelsEl.prepend(bundleLeaders);
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
  root.classList.remove("is-dark");
  root.style.setProperty("--bg", "#ffffff");
  root.style.setProperty("--ink", "#000000");
  root.style.removeProperty("--story-screens");
  const stage = document.querySelector(".story__stage");
  stage.style.clipPath = ""; stage.style.removeProperty("--sky");
  for (const selector of [".hero__stage", ".hero__rise", ".hero__copy"]) {
    const el = document.querySelector(selector); el.style.opacity = "1"; el.style.visibility = "visible"; el.style.translate = "";
  }
  for (const c of chapterEls) { c.el.style.opacity = ""; c.el.style.translate = ""; c.el.style.visibility = ""; }
}

const motion = gsap.matchMedia();
motion.add({ animate: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, context => {
  if (context.conditions.reduce) { goStatic(); return; }
  return runStory();
});
if (import.meta.hot) import.meta.hot.dispose(() => motion.revert());

function runStory() {
  root.classList.remove("is-static"); storyEl.classList.remove("is-static");
  root.style.setProperty("--story-screens", String(TOTAL_SCREENS + 1));
  let disposed = false;
  const room = (ROOM_MODE === "glb" ? createLiveRoom : createRoom)(document.querySelector(".room-finale"));

  /* page-load moment (once), timed as the reference: masked lines rise 110% over 0.8s with a 0.05s
     stagger, the sentence with them; the action pops in from 0.4s */
  gsap.timeline({ defaults: { ease: "power2.out" } })
    .from(".site-header", { autoAlpha: 0, y: -8, duration: 0.6 }, 0)
    .from(".hero__title .line__inner", { yPercent: 110, duration: 0.8, stagger: 0.05 }, 0)
    .from(".hero__lede", { autoAlpha: 0, y: 24, duration: 0.8 }, 0)
    .from(".hero__cta", { autoAlpha: 0, y: 20, scale: 0.9, duration: 0.6, ease: "back.out(1.7)" }, 0.4)
    .from(".hero__rise", { opacity: 0, duration: 1.2, ease: "power2.out" }, 0.15);   // opacity only (render() owns its visibility); not the stage, whose opacity would lift the headline over the tower

  /* Live street-level city → isometric daylight → wireframe; stills are fallbacks only. */
  const dayImage = document.querySelector(".hero__poster");
  const isoLayer = document.querySelector(".hero__iso");
  const riseLayer = document.querySelector(".hero__rise");
  const heroStage = document.querySelector(".hero__stage");
  const heroCopy = document.querySelector(".hero__copy");
  // the lift is applied to the headline and the bottom row, not their wrapper: opacity/translate on
  // the wrapper would flatten them into one layer under the city canvas (the sentence must stay above it)
  const heroParts = [".hero__title", ".hero__haze", ".hero__aside"].map((q) => document.querySelector(q));
  const storyStage = document.querySelector(".story__stage");
  let frameInset = 12, frameRadius = 20;
  const measureFrame = () => {
    const cs = getComputedStyle(storyStage);
    frameInset = parseFloat(cs.getPropertyValue("--frame-inset")) || 0;
    frameRadius = parseFloat(cs.getPropertyValue("--frame-radius")) || 0;
  };
  measureFrame();
  let lastClip = "";
  const canvas = document.querySelector(".story__canvas");
  const wireCanvas = document.querySelector(".story__canvas--wire");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  /* 3D: loaded after first paint, so the hero never waits for it */
  let story = null;
  const load = () => import("./story/scene.js").then(({ createStory }) => {
    if (disposed) return;
    try {
      story = createStory({ canvas, wireCanvas, stage: heroStage, media: dayImage });
      render(state.p);
      // The GLB and texture load asynchronously; keep the poster until ready.
    } catch (err) {
      console.warn("3D unavailable, showing the static story", err);
      master.scrollTrigger?.kill(); master.pause(); goStatic();
    }
  }).catch(err => { if (!disposed) { console.warn("3D failed to load", err); master.scrollTrigger?.kill(); master.pause(); goStatic(); } });
  if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 1500 }); else setTimeout(load, 300);

  const state = { p: 0 };
  let lastBg = "";

  // The day city, camera rise and traffic are live meshes in the existing city renderer.
  // Still images remain visible only until WebGL is ready, or in the static fallback.
  const animateTraffic = (_time, deltaMs) => {
    if (story?.error && !storyEl.classList.contains("is-static")) {
      master.scrollTrigger?.kill(); master.pause(); goStatic(); return;
    }
    if (story?.ready && !storyEl.classList.contains("is-live-3d")) {
      storyEl.classList.add("is-live-3d"); render(state.p);
    }
    if (story && !storyEl.classList.contains("is-static")) story.tick(deltaMs / 1000);
    if (!storyEl.classList.contains("is-static")) room.update(state.p);
  };
  gsap.ticker.add(animateTraffic);

  function render(p) {
    const { bg, ink, dark } = pageColors(p);
    if (bg !== lastBg) {
      root.style.setProperty("--bg", bg);
      root.style.setProperty("--ink", ink);
      themeMeta.setAttribute("content", bg);
      lastBg = bg;
    }
    root.classList.toggle("is-dark", dark);

    // the copy lifts away, and the camera rises from street level to the isometric view
    const rise = local(p, "rise");
    // the hero frame opens to the full screen as the rise begins; the sky tint gives way to the page
    // colour before the wireframe, so the hand-over meets the same full-screen frame as before
    const u = 1 - smooth(0, 0.35, rise);
    const clip = u > 0 ? `inset(${(frameInset * u).toFixed(2)}px round ${(frameRadius * u).toFixed(2)}px)` : "none";
    if (clip !== lastClip) { storyStage.style.clipPath = clip; lastClip = clip; }
    storyStage.style.setProperty("--sky", (1 - smooth(0.55, 0.95, rise)).toFixed(3));
    riseLayer.style.visibility = story?.ready ? "hidden" : "visible";
    isoLayer.style.opacity = "0";
    const lift = smooth(0.0, 0.2, rise);
    for (const el of heroParts) {
      el.style.opacity = lift > 0 ? String(1 - lift) : "";
      el.style.translate = lift > 0 ? `0 ${(-lift * 24).toFixed(1)}px` : "";
    }
    heroCopy.style.visibility = lift >= 1 ? "hidden" : "";

    // the day render hands over to the 3D wireframe: the canvas (page colour + lines drawn exactly on
    // the render's edges) fades in over it while the page darkens to the warm night
    const wireOn = local(p, "wireOn");
    heroStage.style.opacity = String(1 - smooth(0.3, 0.6, wireOn));
    heroStage.style.visibility = wireOn >= 1 ? "hidden" : "";
    canvas.style.opacity = story?.ready ? "1" : "0";
    canvas.style.zIndex = "0";
    // hand-over: the product wire's canvas fades in over an identical frame of the city wire
    const wireIn = local(p, "wireIn");
    wireCanvas.style.opacity = String(smooth(0, 0.4, wireIn));
    wireCanvas.style.visibility = wireIn > 0 ? "visible" : "hidden";
    canvas.style.visibility = wireIn >= 0.5 ? "hidden" : "";

    // chapter copy
    for (const c of chapterEls) {
      const t = local(p, c.id);
      const a = c.id === "finale" ? windowed(finaleU(p), 7.48, 7.54, 7.68, 7.74) : windowed(t, 0.08, 0.24, 0.8, 0.94);
      c.el.style.opacity = a.toFixed(3);
      c.el.style.translate = `0 ${((1 - smooth(0.08, 0.3, t)) * 18).toFixed(1)}px`;
      c.el.style.visibility = a > 0.001 ? "visible" : "hidden";
    }

    room.update(p);
    let anchors = null;
    if (story) anchors = story.update(p, { bg }).anchors;

    // labels pinned to the wire
    const la = Math.max(windowed(local(p, "strands"), 0.36, 0.5, 0.76, 0.88),windowed(local(p,"bundle"),.48,.65,.85,.98));
    labelsEl.style.opacity = la.toFixed(3);
    labelsEl.style.visibility = la > 0.001 && anchors ? "visible" : "hidden";
    if (anchors && la > 0.001) for (const id in labelEls) {
      const a = anchors[id];
      labelEls[id].style.visibility = a ? "visible" : "hidden";
      if(!a)continue;
      labelEls[id].style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
      if(id.startsWith('bundle')) {
        const index=Object.keys(bundlePaths).indexOf(id),phone=innerWidth<760;
        const margin=phone?32:60,gap=phone?16:24,cols=phone?2:4;
        const width=Math.min(phone?180:200,(innerWidth-2*margin-gap*(cols-1))/cols);
        const x=phone?margin+(index%2)*(width+gap):margin+index*(innerWidth-2*margin-width)/3;
        const y=phone?innerHeight*(index<2?.78:.89):innerHeight*.86;
        const tag=labelEls[id].querySelector('.label__tag');
        tag.style.width=`${width}px`;
        tag.style.transform=`translate3d(${x-a.x}px,${y-a.y}px,0)`;
        bundlePaths[id].setAttribute('d',`M ${a.x} ${a.y} L ${x+width/2} ${y-12} L ${x+width/2} ${y}`);
      }
    }
    bundleLeaders.style.visibility=anchors?.bundleSheath&&la>.001?'visible':'hidden';

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

  // One labeled GSAP timeline owns all story progress. Scrubbing backward is deterministic.
  const master = gsap.timeline({
    defaults: { ease: "none" },
    onUpdate: () => render(state.p),
    scrollTrigger: { id: "tamira-story", trigger: storyEl, start: "top top", end: "bottom bottom", scrub: 0.6 },
  });
  let elapsed = 0;
  for (const segment of SEGMENTS) {
    master.addLabel(segment.id, elapsed);
    elapsed += segment.screens;
    master.to(state, { p: elapsed / TOTAL_SCREENS, duration: segment.screens });
  }
  const resize = () => { measureFrame(); lastClip = ""; story?.resize(); render(state.p); };
  window.addEventListener("resize", resize);
  document.fonts.ready.then(() => { if (!disposed) { resize(); ScrollTrigger.refresh(); } });
  const lost = event => { event.preventDefault(); storyEl.classList.remove("is-live-3d"); master.scrollTrigger?.kill(); master.pause(); goStatic(); };
  canvas.addEventListener("webglcontextlost", lost);
  wireCanvas.addEventListener("webglcontextlost", lost);
  render(0);

  // dev only: ?at=segment:t jumps to a moment in the story (e.g. ?at=heat:0.6) for review
  if (import.meta.env.DEV) {
    window.__tamira = {
      diagnostics: () => ({ ...story?.diagnostics(), room: room.diagnostics() }),
      seek: (segment, t = 0.5) => {
        const p = progressOf(segment, t);
        if (!Number.isFinite(p)) return;
        master.progress(p); render(state.p);
      },
    };
    const at = new URLSearchParams(location.search).get("at");
    if (at) {
      const [id, t] = at.split(":");
      const p = progressOf(id, parseFloat(t || "0"));
      const st = ScrollTrigger.getAll()[0];
      if (Number.isFinite(p)) requestAnimationFrame(() => window.scrollTo(0, st.start + (st.end - st.start) * p));
    }
  }
  return () => {
    disposed = true;
    gsap.ticker.remove(animateTraffic);
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("webglcontextlost", lost); wireCanvas.removeEventListener("webglcontextlost", lost);
    room.dispose(); story?.dispose();
    storyEl.classList.remove("is-live-3d");
    canvas.style.opacity = "0"; wireCanvas.style.opacity = "0";
    riseLayer.style.visibility = ""; isoLayer.style.opacity = "";
    heroCopy.style.visibility = "";
    for (const el of heroParts) { el.style.opacity = ""; el.style.translate = ""; }
    storyStage.style.clipPath = ""; storyStage.style.removeProperty("--sky");
    if (import.meta.env.DEV) delete window.__tamira;
  };

}
