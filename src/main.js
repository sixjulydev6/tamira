import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { SEGMENTS, TOTAL_SCREENS, local, smooth, windowed, lerp, progressOf } from "./story/timeline.js";
import { createRoom } from "./story/room.js";
import { createLiveRoom } from "./story/room-live.js";
import { createLoader } from "./loader.js";

// The room at the end: the 48 rendered images on every device (user direction, DECISIONS 34: the live
// GLB room was breaking). ?room=glb opens the GLB room on desktop for development only.
const PHONE = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
const ROOM_MODE = !PHONE && new URLSearchParams(location.search).get("room") === "glb" ? "glb" : "images";
import { finaleU } from "./story/finale-timing.js";
import { pageColors } from "./story/palette.js";
import { CHAPTERS, LABELS, GAUGE } from "./story/chapters.js";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;

/* ------------------------------------------------------------------ loader */
// Real progress, weighted: fonts 10%, the hero poster 10%, the 3D chunk 10%, the city GLB's bytes
// 60%, its first render 10%. The static path (reduced motion, no WebGL) finishes on fonts + poster.
const loader = createLoader(document.querySelector(".loader"));
const loadState = { fonts: 0, poster: 0, chunk: 0, city: 0, ready: 0 };
const updateLoader = () => {
  const l = loadState;
  loader.set(l.fonts * 0.1 + l.poster * 0.1 + l.chunk * 0.1 + l.city * 0.6 + l.ready * 0.1);
};
document.fonts.ready.then(() => { loadState.fonts = 1; updateLoader(); });
{
  const poster = document.querySelector(".hero__opening");
  const posterDone = () => { loadState.poster = 1; updateLoader(); };
  if (!poster || poster.complete) posterDone();
  else { poster.addEventListener("load", posterDone, { once: true }); poster.addEventListener("error", posterDone, { once: true }); }
}
const finishWhenStatic = () => Promise.all([document.fonts.ready, new Promise((r) => { const t = setInterval(() => { if (loadState.poster) { clearInterval(t); r(); } }, 50); })]).then(() => loader.finish());

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
// one leader path per label: the bundle labels always, the strand labels on phones (stacked, see render)
const bundlePaths=Object.fromEntries(LABELS.map(l=>{
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

/* Wrap each word of an element's text in <span class="word"> (spaces stay as text), so the reveal
   can move words. Screen readers still read one sentence; runs once per element. */
function splitWords(selector) {
  for (const el of document.querySelectorAll(selector)) {
    if (el.dataset.split) continue;
    el.dataset.split = "1";
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((w, i) => {
      if (i) el.append(" ");
      const span = document.createElement("span");
      span.className = "word"; span.textContent = w;
      el.append(span);
    });
  }
}

/* ------------------------------------------------------------------ static fallback (reduced motion, or no WebGL) */
const storyEl = document.querySelector(".story");
function goStatic() {
  finishWhenStatic();
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

  /* Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger and the story render on the same
     frame. Wheel and trackpad are smoothed; touch keeps native momentum. Reduced motion never gets
     here (goStatic), so it keeps native scrolling. In-page anchors glide through Lenis. */
  const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  const lenisRaf = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(lenisRaf);
  gsap.ticker.lagSmoothing(0);
  if (loader.active) { lenis.stop(); loader.onDone(() => { if (!disposed) { lenis.start(); ScrollTrigger.refresh(); } }); }

  /* Hero reveal, once, as the loader's panel clears (loader.onRevealed):
     - headline: each word rises out of its line's mask, 0.045s apart (on phones the lines run on
       without masks, so the words also fade);
     - sentence: its words drift up 14px and fade in, 0.012s apart, starting under the headline;
     - nav: the panel settles down into place, then its links arrive left to right, Contact us last
       (phones: the Menu button);
     - the action settles in last. Transform and opacity only; the header itself never moves. */
  splitWords(".hero__title .line__inner");
  splitWords(".hero__lede");
  const desktopNav = matchMedia("(min-width: 1024px)").matches;
  const intro = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } })
    .from(".hero__title .word", { yPercent: 115, opacity: 0, duration: 0.85, stagger: 0.045, ease: "power4.out", clearProps: "transform,opacity" }, 0)
    .from(".hero__lede .word", { y: 14, opacity: 0, duration: 0.65, stagger: 0.012, clearProps: "transform,opacity" }, 0.28)
    .from(".primary-nav", { autoAlpha: 0, y: -12, duration: 0.6, clearProps: "transform" }, 0.3)   // after the loader's count has cleared the top
    .from(desktopNav ? ".nav-list > li" : ".menu-toggle", { autoAlpha: 0, y: -8, duration: 0.5, stagger: 0.04, clearProps: "transform" }, 0.4)
    .from(".hero__rise", { opacity: 0, duration: 1.1, ease: "power2.out" }, 0);   // opacity only (render() owns its visibility); not the stage, whose opacity would lift the headline over the tower
  loader.onRevealed(() => { if (!disposed) intro.play(); });

  /* Live street-level city → isometric daylight → wireframe; stills are fallbacks only. */
  const dayImage = document.querySelector(".hero__poster");
  const isoLayer = document.querySelector(".hero__iso");
  const riseLayer = document.querySelector(".hero__rise");
  const heroStage = document.querySelector(".hero__stage");
  const heroCopy = document.querySelector(".hero__copy");
  // the lift is applied to the headline and sentence, not their wrappers: opacity/translate on
  // the wrapper would flatten them into one layer under the city canvas (the sentence must stay above it)
  const heroParts = [".hero__title", ".hero__lede"].map((q) => document.querySelector(q));
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
    loadState.chunk = 1; updateLoader();
    try {
      story = createStory({ canvas, wireCanvas, stage: heroStage, media: dayImage });
      render(state.p);
      // The GLB and texture load asynchronously; keep the poster until ready.
    } catch (err) {
      console.warn("3D unavailable, showing the static story", err);
      master.scrollTrigger?.kill(); master.pause(); goStatic();
    }
  }).catch(err => { if (!disposed) { console.warn("3D failed to load", err); master.scrollTrigger?.kill(); master.pause(); goStatic(); } });
  // with the loader up the 3D starts at once; otherwise (loader already gone) after first paint
  if (loader.active) load();
  else if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 1500 }); else setTimeout(load, 300);

  const state = { p: 0 };
  let lastBg = "";

  // The day city, camera rise and traffic are live meshes in the existing city renderer.
  // Still images remain visible only until WebGL is ready, or in the static fallback.
  const animateTraffic = (_time, deltaMs) => {
    if (story?.error && !storyEl.classList.contains("is-static")) {
      master.scrollTrigger?.kill(); master.pause(); goStatic(); return;
    }
    if (story && loader.active) {
      loadState.city = story.progress; loadState.ready = story.ready ? 1 : 0; updateLoader();
      if (story.ready) loader.finish();
    }
    if (story?.ready && !storyEl.classList.contains("is-live-3d")) {
      storyEl.classList.add("is-live-3d"); render(state.p);
    }
    if (story && !storyEl.classList.contains("is-static")) story.tick(deltaMs / 1000);
    if (!storyEl.classList.contains("is-static")) room.update(state.p);
  };
  gsap.ticker.add(animateTraffic);

  // Phone layout for the three strand tags, in the bundle labels' pattern: tags in the clear space either side of
  // the wire, each joined to its pin by a short leader. The wire runs lower-left to upper-right; the copper tag sits
  // above it on the left, the jacket and rating tags side by side below it (user direction 2026-11-09). The wire's
  // screen edges come from scene.js (anchors.wireEdges), so the tags clear it on any phone size; the rows also stay
  // under the chapter copy and above the bottom of the screen.
  const STRAND_TAGS = ["strands", "jacket", "rating"];
  function stackStrandTags(anchors) {
    if (!STRAND_TAGS.every((id) => anchors[id]) || !anchors.wireEdges) return null;
    const W = innerWidth, m = 20, gap = 12, clear = 14, tagOf = (id) => labelEls[id].querySelector(".label__tag");
    // the two edge lines as y(x); the upper one on screen is the top edge
    const lines = anchors.wireEdges.map(([p, q]) => (x) => p.y + (q.y - p.y) * (x - p.x) / ((q.x - p.x) || 1));
    const [topY, botY] = lines[0](W / 2) < lines[1](W / 2) ? lines : [lines[1], lines[0]];
    const cr = chapterEls.find((c) => c.id === "strands")?.el.getBoundingClientRect();
    const minTop = (cr ? cr.bottom : 0) + 12, maxBottom = innerHeight - 16;
    const leader = (a, cx, y) => `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${cx.toFixed(1)} ${y.toFixed(1)}`;
    const out = {};
    // above the wire: copper, on the left where the wire is lowest (on the right it covered the strands); its
    // bottom clears the top edge across its width. Its leader runs up from the pin, then across to the tag's edge.
    const a = anchors.strands, t = tagOf("strands"), w = Math.min(200, W * 0.52);
    t.style.width = `${w}px`;
    const h = t.offsetHeight, x = m;
    // the edge lines are the jacket's sides, a little inside the wire's visible outline (the clear sleeve over the
    // strands is wider), so the tag sits high: just under the copy, or lower only if the wire leaves room
    const top = Math.min(maxBottom - h, Math.max(minTop, Math.min(minTop + 16, Math.min(topY(x), topY(x + w)) - clear - 40 - h)));
    const ty = top + h / 2, ex = x + w;
    out.strands = { x, top, d: a.x > ex + 8
      ? `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${a.x.toFixed(1)} ${ty.toFixed(1)} L ${ex.toFixed(1)} ${ty.toFixed(1)}`
      : leader(a, Math.min(ex - 16, Math.max(x + 16, a.x)), top + h) };
    // below the wire: jacket and rating side by side (pins on the red jacket, lower left), in the pins' left-to-right
    // order; the row's top clears the bottom edge across its width
    const w2 = Math.min(190, (W - 2 * m - gap) / 2);
    const pair = ["jacket", "rating"].sort((p, q) => anchors[p].x - anchors[q].x);
    pair.forEach((id) => { tagOf(id).style.width = `${w2}px`; });
    const h2 = Math.max(...pair.map((id) => tagOf(id).offsetHeight));
    const rowTop = Math.max(minTop, Math.min(maxBottom - h2, Math.max(botY(m), botY(m + 2 * w2 + gap)) + clear));
    pair.forEach((id, i) => {
      const x = m + i * (w2 + gap), a = anchors[id], cx = Math.min(x + w2 - 16, Math.max(x + 16, a.x));
      out[id] = { x, top: rowTop, d: leader(a, cx, rowTop) };
    });
    return out;
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
    // outro: the city canvas returns under the darkened room, which then fades away
    const outro = local(p, "outro");
    wireCanvas.style.visibility = wireIn > 0 && outro === 0 ? "visible" : "hidden";
    canvas.style.visibility = wireIn >= 0.5 && outro === 0 ? "hidden" : "";

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
    const stacked = anchors && la > 0.001 && innerWidth < 760 ? stackStrandTags(anchors) : null;
    if (anchors && la > 0.001) for (const id in labelEls) {
      const a = anchors[id];
      labelEls[id].style.visibility = a ? "visible" : "hidden";
      if(!a){bundlePaths[id].setAttribute('d','');continue;}   // no stale leader from another chapter
      labelEls[id].style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
      // strand labels: slide the tag back inside the screen when the pin sits near an edge (phones); the pin
      // and its leader stay on the wire. Measured from the tag's own size, so it holds for any copy length.
      if(!id.startsWith('bundle')){
        const tag=labelEls[id].querySelector('.label__tag'),phone=innerWidth<760;
        labelEls[id].classList.toggle('label--stacked',phone);
        if(phone){
          // Phones: the three strand tags overlapped each other's pins and leaders where the wire crosses the
          // narrow screen; stackStrandTags places them either side of the wire with elbow leaders.
          const L=stacked?.[id];if(!L)continue;
          tag.style.translate=`${(L.x-(a.x+12)).toFixed(1)}px ${(L.top-(a.y-52-tag.offsetHeight)).toFixed(1)}px`;
          bundlePaths[id].setAttribute('d',L.d);
          continue;
        }
        bundlePaths[id].setAttribute('d','');tag.style.width='';
        const m=12,w=tag.offsetWidth,left=a.x+12;
        const dx=Math.min(0,innerWidth-m-(left+w))+Math.max(0,m-left);
        // and below the chapter copy (short phones): the tag's top sits 52px + its height above the pin
        const cr=chapterEls.find(c=>c.id==='strands')?.el.getBoundingClientRect(),tl=left+dx;
        const under=cr&&tl<cr.right&&tl+w>cr.left;   // only when the tag sits under the copy's column
        const dy=under?Math.max(0,cr.bottom+8-(a.y-52-tag.offsetHeight)):0;
        tag.style.translate=dx||dy?`${dx.toFixed(1)}px ${dy.toFixed(1)}px`:'';
      }
      if(id.startsWith('bundle')) {
        const index=Object.keys(bundlePaths).indexOf(id),phone=innerWidth<760;
        const margin=phone?32:60,gap=phone?16:24,cols=phone?2:4;
        const width=Math.min(phone?180:200,(innerWidth-2*margin-gap*(cols-1))/cols);
        const x=phone?margin+(index%2)*(width+gap):margin+index*(innerWidth-2*margin-width)/3;
        const tag=labelEls[id].querySelector('.label__tag');
        tag.style.width=`${width}px`;
        // Phones: sheath and bedding (pins on the cable's top surface) sit in a row above the cable, under the
        // chapter copy; insulation and conductor in a row below it. Leaders run up or down to the nearer edge.
        const top=phone&&index<2;
        let y=phone?innerHeight*.84:innerHeight*.86;
        if(top){
          const h=tag.offsetHeight,cr=chapterEls.find(c=>c.id==='bundle')?.el.getBoundingClientRect();
          const pinTop=Math.min(anchors.bundleSheath.y,anchors.bundleBedding.y);
          y=Math.max(cr?cr.bottom+16:0,pinTop-48-h);
          bundlePaths[id].setAttribute('d',`M ${a.x} ${a.y} L ${x+width/2} ${y+h+12} L ${x+width/2} ${y+h}`);
        } else bundlePaths[id].setAttribute('d',`M ${a.x} ${a.y} L ${x+width/2} ${y-12} L ${x+width/2} ${y}`);
        tag.style.transform=`translate3d(${x-a.x}px,${y-a.y}px,0)`;
      }
    }
    bundleLeaders.style.visibility=(anchors?.bundleSheath||(anchors&&innerWidth<760))&&la>.001?'visible':'hidden';

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
    scrollTrigger: { id: "tamira-story", trigger: storyEl, start: "top top", end: "bottom bottom", scrub: 0.3 },   // Lenis already smooths the input; a short scrub only rounds off keyboard jumps
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
      lenis, progress: () => state.p,
      segmentAt: (p) => SEGMENTS.find((sg) => local(p, sg.id) < 1)?.id ?? "end",
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
      if (Number.isFinite(p)) requestAnimationFrame(() => lenis.scrollTo(st.start + (st.end - st.start) * p, { immediate: true }));
    }
  }
  return () => {
    disposed = true;
    gsap.ticker.remove(animateTraffic);
    gsap.ticker.remove(lenisRaf); gsap.ticker.lagSmoothing(500, 33); lenis.destroy();
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
