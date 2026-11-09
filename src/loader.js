/* Loader: one red Tamira core runs in from the left edge as the page loads, its stripped copper tip
   marking the real progress; the count beside it is the same number. When everything is in, the
   tip runs off the right edge and the panel lifts away to the hero (main.js plays the intro then).

   Progress is set from real work (fonts, the poster, the 3D chunk, the city GLB's bytes, the first
   render). The shown value eases toward it and holds at 99 until finish(). Without script the
   loader never shows (index.html adds .is-loading only when script runs).

   The line under the sentence estimates the time left until the opening is up (not the whole site:
   the room and later chapters keep loading after the reveal). The progress number is too lumpy for
   that (the 3D chunk and textures add nothing until they finish, preloaded files land at once), so
   the estimate is bytes: what the opening downloads (OPENING_BYTES) less what has arrived (Resource
   Timing), over the download speed (the faster of the measured rate and the browser's own
   connection estimate, since in-flight bytes are not yet counted). Capped by MAX_WAIT_MS.
   */

const MIN_SHOWN_MS = 2200;     // a cached visit still reads as a deliberate beat, not a flash
const MAX_WAIT_MS = 15000;     // never hold the page: past this the hero shows with its poster
const MAX_SPEED = 0.55;        // the core never crosses more than 55% of the screen a second
const EASE_RATE = 3.2;         // per second: how quickly the shown value settles on the real one
const HOLD_FULL_MS = 80;      // a beat at 100% before the tip runs off
const RUN_OFF_MS = 600;
const LIFT_MS = 1300;
// Bytes transferred before the opening shows (production build, brotli): JS + CSS + fonts, poster,
// city-v2.glb, day-env-512.hdr and the first-view textures. Measured 2026-11-09 at 1.36 MB (with DM Sans); update
// it when the opening's assets change (performance.getEntriesByType("resource") after the reveal).
const OPENING_BYTES = 1.36e6;
const AFTER_BYTES_S = 1.7;     // parse, upload, the shader pre-compile (~1.1 s desktop) and the first render once the bytes are in
const LATER = /\/room|\/favicon/;   // loaded for later chapters, not the opening
const ETA_FIRST_MS = 700;      // no estimate before this much data
const ETA_EVERY_MS = 250;

export function createLoader(el) {
  const root = document.documentElement;
  if (!el || !root.classList.contains("is-loading")) {
    root.classList.remove("is-loading");
    return { set() {}, finish() {}, onDone(cb) { cb(); }, onRevealed(cb) { cb(); }, get active() { return false; } };
  }
  const cable = el.querySelector(".loader__cable");
  const count = el.querySelector(".loader__count-value");
  const eta = el.querySelector(".loader__eta");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const started = performance.now();
  const callbacks = [], revealed = [];
  let isRevealed = false;
  let target = 0, shown = 0, finishing = false, done = false, raf = 0, last = 0;
  let etaSec = null, etaAt = 0, etaText = "";
  const setEta = (text) => {
    if (!eta || text === etaText) return;
    etaText = text;
    if (text) eta.textContent = text;
    eta.classList.toggle("is-shown", !!text);
  };
  const updateEta = (now) => {
    if (finishing) { setEta(""); return; }
    if (now - etaAt < ETA_EVERY_MS) return;
    etaAt = now;
    if (now - started < ETA_FIRST_MS || !performance.getEntriesByType) return;
    let got = 0, from = Infinity;
    for (const e of performance.getEntriesByType("resource")) {
      if (LATER.test(e.name)) continue;
      from = Math.min(from, e.startTime);
      got += e.transferSize || e.encodedBodySize || 0;   // cached files report no transfer
    }
    if (!(from < now)) return;
    const measured = got / ((now - from) / 1000);                   // bytes per second, a lower bound
    const reported = (navigator.connection?.downlink || 0) * 125000;   // Mbps, Chromium only
    const speed = Math.max(measured, reported);
    if (!speed) return;
    const capLeft = Math.max(0, MAX_WAIT_MS - (now - started));   // the loader never waits past this
    const minLeft = Math.max(0, MIN_SHOWN_MS - (now - started));
    const raw = Math.max(minLeft / 1000, Math.min(capLeft / 1000, Math.max(0, OPENING_BYTES - got) / speed + AFTER_BYTES_S));
    // settle toward the new figure, and count down on its own between samples
    const ticked = etaSec == null ? raw : Math.max(0, etaSec - ETA_EVERY_MS / 1000);
    etaSec = ticked + (raw - ticked) * 0.25;
    const s = Math.ceil(etaSec);
    setEta(s <= 2 ? "" : `About ${s} seconds left`);   // hidden for the last 2 seconds
  };

  const draw = (p) => {
    // the cable is one screen long; at p its copper tip has crossed p of the screen, so at 100%
    // the strands just touch the right edge (style.css turns --p into the transform)
    cable.style.setProperty("--p", p.toFixed(4));
  };
  const frame = (now) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const cap = finishing ? 1 : 0.99;
    const goal = Math.min(target, cap);
    // frame-rate independent ease, with a speed limit so a fast (cached) load still glides
    const step = (goal - shown) * (1 - Math.exp(-(finishing ? EASE_RATE * 4 : EASE_RATE) * dt));   // the last stretch closes quickly once everything is in
    shown = reduce ? goal : shown + Math.sign(step) * Math.min(Math.abs(step), (finishing ? MAX_SPEED * 3 : MAX_SPEED) * dt);
    if (Math.abs(goal - shown) < (finishing ? 0.004 : 0.0005)) shown = goal;   // no slow crawl from 99.6 to 100
    draw(shown);
    count.textContent = String(Math.round(shown * 100));
    updateEta(now);
    if (finishing && shown >= 1) { setTimeout(runOff, reduce ? 0 : HOLD_FULL_MS); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const runOff = () => {
    if (done) return;
    done = true;
    if (!reduce) {
      cable.style.transition = `transform ${RUN_OFF_MS}ms cubic-bezier(0.45, 0, 0.55, 1)`;   // ease in-out: picks up, then glides off
      draw(1.4);
    }
    setTimeout(() => {
      el.classList.add("is-leaving");
      root.classList.remove("is-loading");
      callbacks.splice(0).forEach((cb) => cb());
      // the panel lifts from the bottom up, so the headline at the top clears last: the hero's
      // reveal starts once most of it is uncovered, and is seen rather than played underneath
      setTimeout(() => { isRevealed = true; revealed.splice(0).forEach((cb) => cb()); }, reduce ? 0 : LIFT_MS * 0.45);
      setTimeout(() => el.remove(), reduce ? 320 : LIFT_MS + 50);
    }, reduce ? 0 : RUN_OFF_MS * 0.65);   // the lift begins as the copper clears the edge, so the two moves overlap
  };

  // dev only: ?loaderhold=0.64 holds the loader at that progress for review
  const HOLD = import.meta.env.DEV && new URLSearchParams(location.search).get("loaderhold");
  if (HOLD) target = +HOLD;
  const finish = () => {
    if (HOLD) return;
    if (finishing) return;
    const wait = Math.max(0, MIN_SHOWN_MS - (performance.now() - started));
    setTimeout(() => { finishing = true; target = 1; if (!raf) raf = requestAnimationFrame(frame); }, wait);
  };
  setTimeout(finish, MAX_WAIT_MS);

  return {
    set(p) { if (HOLD) return; if (!finishing) target = Math.max(target, Math.min(1, p)); },
    finish,
    onDone(cb) { if (done) cb(); else callbacks.push(cb); },
    onRevealed(cb) { if (isRevealed) cb(); else revealed.push(cb); },
    get active() { return !done; },
  };
}
