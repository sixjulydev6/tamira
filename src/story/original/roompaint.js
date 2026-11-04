// The room at the end, painted into one canvas. Each frame it works out which levels and lighting steps
// are on screen (see roomview.js for the pull-back's window) and draws them, widest level first, each
// closer level fading in at its baked-in soft edges. Images are fetched once, then decoded off the main
// thread a little ahead of when they're needed and let go once they're well behind, so only a few are
// held at a time. Anything not decoded yet falls back to what is (an earlier step, a wider level), and
// if even the widest isn't ready the last painted frame stays: the 3D underneath never shows through.

import { windowAt } from './roomview.js';
import { smooth } from '../timeline.js';

// How far behind and ahead of the current position (in story units) images are kept decoded
const BEHIND = 0.04, AHEAD = 0.16;
// A level is drawn only while it spans enough of the screen to be the sharpest thing there
const KEEP = [0.36, 0.48];
// The width of the soft edges baked into the closer levels, as a share of their size
const EDGE = 0.07;

export class RoomPainter {
  // g: the frame's geometry (ROOM_VIEW.d or .p). url(name, step): an image's address.
  // beats: { pull: [u0, u1], steps: [[u0, u1], ...] } for the pull-back and each lighting step.
  // sharp: canvas pixels per CSS pixel at most, about the images' own density on this kind of screen.
  constructor(canvas, g, url, beats, sharp) {
    Object.assign(this, { canvas, g, url, beats, sharp });
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.blobs = new Map();
    this.bmps = new Map();
    this.pending = new Set();
    this.lastSeen = new Map();
    this.dirty = true;
    this.last = { u: -1, w: 0, h: 0 };
    this.alive = true;
    this.painted = false;
    // For the speed checks: frames painted, frames that had to use a stand-in, frames left as they were
    this.stats = { paints: 0, standIns: 0, held: 0 };
  }

  // Fetch every frame's file now; decoding waits until each is about to be needed
  load() {
    const jobs = [];
    this.g.levels.forEach((lv) => {
      for (let s = 0; s <= this.beats.steps.length; s++) {
        const key = `${lv.name}-${s}`;
        jobs.push(fetch(this.url(lv.name, s)).then((r) => { if (!r.ok) throw new Error(`Room asset ${r.status}`); return r.blob(); }).then((b) => { if (this.alive) { this.blobs.set(key, b); this.pump(); } }).catch(() => {}));
      }
    });
    return Promise.all(jobs);
  }

  // What's drawn at u on a w x h screen: levels widest first, each with its finished step and the one
  // fading in over it
  plan(u, w, h) {
    const { g, beats } = this;
    const [p0, p1] = beats.pull;
    const win = windowAt(g, Math.min(1, Math.max(0, (u - p0) / (p1 - p0))), w / h);
    const steps = beats.steps.map(([a, b]) => smooth(a, b, u));
    let done = 0;
    steps.forEach((v, i) => { if (v >= 0.999) done = i + 1; });
    const fading = done < steps.length && steps[done] > 0.001 ? steps[done] : 0;
    const sx = w / win.w, sy = h / win.h;
    const out = [];
    g.levels.forEach((lv, li) => {
      const [x0, y0, x1, y1] = lv.region;
      const r = { x: (x0 - win.x0) * sx, y: (y0 - win.y0) * sy, w: (x1 - x0) * sx, h: (y1 - y0) * sy };
      const keep = li === 0 ? 1 : smooth(KEEP[0], KEEP[1], r.w / w);
      if (keep <= 0 || r.x >= w || r.y >= h || r.x + r.w <= 0 || r.y + r.h <= 0) return;
      // Once a closer level covers the whole screen with its solid middle, nothing under it shows
      const ex = li ? EDGE : 0;
      const core = { x0: r.x + (x0 > 0.001 ? ex * r.w : 0), y0: r.y + (y0 > 0.001 ? ex * r.h : 0), x1: r.x + r.w - (x1 < 0.999 ? ex * r.w : 0), y1: r.y + r.h - (y1 < 0.999 ? ex * r.h : 0) };
      const covers = keep >= 1 && core.x0 <= 0 && core.y0 <= 0 && core.x1 >= w && core.y1 >= h;
      out.push({ li, name: lv.name, r, keep, step: done, fade: fading, covers });
    });
    return out;
  }

  // Decode what the next stretch needs, nearest first; let go of what's well behind
  pump() {
    if (!this.alive || !this.last.w) return;
    const { u, w, h } = this.last;
    const want = [];
    for (let k = 0; k <= 12; k++) {
      const uu = u - BEHIND + ((BEHIND + AHEAD) * k) / 12;
      for (const d of this.plan(uu, w, h)) {
        want.push(`${d.name}-${d.step}`);
        if (d.step < this.beats.steps.length) want.push(`${d.name}-${d.step + 1}`);
      }
    }
    // Nearest to now first
    const order = [...new Set(want)].sort((a, b) => Math.abs(this.near(a) - u) - Math.abs(this.near(b) - u));
    const now = performance.now();
    order.forEach((key) => this.lastSeen.set(key, now));
    for (const key of order) {
      if (this.pending.size >= 2) break;
      if (this.bmps.has(key) || this.pending.has(key) || !this.blobs.has(key)) continue;
      this.pending.add(key);
      createImageBitmap(this.blobs.get(key)).then((bmp) => {
        this.pending.delete(key);
        if (!this.alive) { bmp.close(); return; }
        this.bmps.set(key, bmp);
        this.dirty = true;
        this.pump();
      }).catch(() => { this.pending.delete(key); });
    }
    for (const [key, bmp] of this.bmps) {
      if (now - (this.lastSeen.get(key) || 0) > 1500) { bmp.close(); this.bmps.delete(key); }
    }
  }

  // Roughly when an image is first needed: its step's start (the level doesn't matter for ordering)
  near(key) {
    const s = +key.slice(key.lastIndexOf('-') + 1);
    return s === 0 ? this.beats.pull[0] - 0.1 : this.beats.steps[s - 1][0];
  }

  // The best decoded image for a level and step: that step, else the latest earlier one
  pick(name, step) {
    for (let s = step; s >= 0; s--) {
      const b = this.bmps.get(`${name}-${s}`);
      if (b) return b;
    }
    return null;
  }

  // Paint the room at u. Called every frame while it shows; only redraws when something changed.
  paint(u) {
    const c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    // As sharp as the images are, and no sharper: about one canvas pixel per image pixel
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(dpr, this.sharp);
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; this.dirty = true; }
    const moved = Math.abs(u - this.last.u) > 1e-5 || w !== this.last.w || h !== this.last.h;
    this.last = { u, w, h };
    if (moved) this.pump();
    if (!moved && !this.dirty) return;
    const all = this.plan(u, w, h);
    // Before the pull-back starts and between steps nothing on screen changes: don't redraw for that
    const sig = all.map((d) => `${d.name}${d.step}:${d.fade.toFixed(3)}:${d.keep.toFixed(3)}:${d.r.x.toFixed(1)},${d.r.y.toFixed(1)},${d.r.w.toFixed(1)}`).join('|') + `|${c.width}x${c.height}`;
    if (sig === this.sig && !this.dirty) return;
    // Start from the closest level that covers the whole screen and is decoded; nothing under it shows.
    // If none is ready, start from the widest. If even that isn't, keep the last frame.
    let from = -1;
    for (let i = all.length - 1; i >= 0; i--) if (all[i].covers && this.pick(all[i].name, all[i].step)) { from = i; break; }
    if (from < 0) from = all.length && this.pick(all[0].name, all[0].step) ? 0 : -1;
    if (from < 0) { this.stats.held += 1; return; }
    const items = all.slice(from);
    this.dirty = false;
    this.sig = sig;
    const ctx = this.ctx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // 'medium' (mipmaps, then a straight blend) looks the same here as 'high' and costs much less,
    // which leaves room for the third draw a closer level needs while a light comes on
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0a09';
    ctx.fillRect(0, 0, w, h);
    for (const d of items) {
      const base = this.pick(d.name, d.step);
      const real = base === this.bmps.get(`${d.name}-${d.step}`);
      if (!real) this.stats.standIns += 1;
      if (!base) continue;
      const next = d.fade > 0 && real ? this.bmps.get(`${d.name}-${d.step + 1}`) : null;
      const { x, y, w: rw, h: rh } = d.r;
      if (!next) {
        ctx.globalAlpha = d.keep;
        ctx.drawImage(base, x, y, rw, rh);
      } else if (d.li === 0) {
        // The full frame is solid: the next step straight over this one is already the exact mix
        ctx.globalAlpha = 1;
        ctx.drawImage(base, x, y, rw, rh);
        ctx.globalAlpha = d.fade;
        ctx.drawImage(next, x, y, rw, rh);
      } else {
        // A closer level has soft edges, and one step drawn over the other would leave a faint outline
        // there mid-fade. So: clear its footprint by its own alpha, then add the two steps in their
        // shares. What's under it keeps (1 - a), the level gives a times the mix, exactly.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = d.keep;
        ctx.drawImage(base, x, y, rw, rh);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = d.keep * (1 - d.fade);
        ctx.drawImage(base, x, y, rw, rh);
        ctx.globalAlpha = d.keep * d.fade;
        ctx.drawImage(next, x, y, rw, rh);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
    this.painted = true;
    this.stats.paints += 1;
  }

  dispose() {
    this.alive = false;
    for (const bmp of this.bmps.values()) bmp.close();
    this.bmps.clear();
    this.blobs.clear();
  }
}
