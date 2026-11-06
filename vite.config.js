import { defineConfig } from "vite";
import { readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

/* Local servers only (`npm run dev`, `npm run preview`): serve the 3D binaries (.glb, .hdr) compressed,
   as the production host does. Vite's own servers send them raw, which makes local Slow 4G tests several
   seconds slower than the deployed site (city-v2.glb: 1.2 MB raw, 0.22 MB brotli). No effect on `vite build`. */
function compressBinaries(rootFor) {
  const cache = new Map();
  const middleware = (root) => (req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (!/\.(glb|hdr)$/.test(url)) return next();
    const accept = String(req.headers["accept-encoding"] || "");
    const enc = /\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : null;
    if (!enc) return next();
    const file = normalize(join(root, decodeURIComponent(url)));
    if (!file.startsWith(normalize(root))) return next();
    let stat;
    try { stat = statSync(file); } catch { return next(); }
    const key = `${file}:${stat.mtimeMs}:${enc}`;
    let body = cache.get(key);
    if (!body) {
      const raw = readFileSync(file);
      body = enc === "br"
        ? brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })
        : gzipSync(raw, { level: 9 });
      cache.set(key, body);
    }
    res.setHeader("Content-Type", url.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream");
    res.setHeader("Content-Encoding", enc);
    res.setHeader("Vary", "Accept-Encoding");
    // no Content-Length, like the production host: the loader then uses the known decoded size for progress
    res.setHeader("Cache-Control", "no-cache");
    res.end(body);
  };
  return {
    name: "tamira:compress-binaries",
    configureServer(server) { server.middlewares.use(middleware(rootFor(server.config, "dev"))); },
    configurePreviewServer(server) { server.middlewares.use(middleware(rootFor(server.config, "preview"))); },
  };
}

export default defineConfig({
  plugins: [
    compressBinaries((config, mode) => (mode === "dev" ? config.publicDir : join(config.root, config.build.outDir))),
  ],
});
