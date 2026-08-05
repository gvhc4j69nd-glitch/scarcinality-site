// Scarcinality — minimal zero-dependency static server.
// Serves ./public, supports extensionless URLs (/treatise -> /treatise.html),
// and binds to the port Railway provides.

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const NASS_KEY = process.env.NASS_API_KEY || "";

const ROOT = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

const CANONICAL_HOST = "www.scarcinality.com";

/* ------------------------------------------------------------------ *
 * Like counts.
 * Persisted to a Railway volume. DATA_DIR should point at the volume
 * mount path; if it is unset or unwritable we fall back to ./.data so
 * local development still works, with the obvious caveat that a
 * container without a volume loses its counts on redeploy.
 * ------------------------------------------------------------------ */
const DATA_DIR = (function () {
  const candidates = [process.env.DATA_DIR, "/data", path.join(__dirname, ".data")].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (e) { /* try the next one */ }
  }
  return null;
})();
const LIKES_FILE = DATA_DIR ? path.join(DATA_DIR, "likes.json") : null;

let likes = {};
if (LIKES_FILE) {
  try { likes = JSON.parse(fs.readFileSync(LIKES_FILE, "utf8")) || {}; }
  catch (e) { likes = {}; }
}
console.log("Like store: " + (LIKES_FILE || "DISABLED (no writable dir)") +
            " — " + Object.keys(likes).length + " pages loaded");

// Debounced atomic write: coalesce bursts, never leave a half-written file.
let writeTimer = null;
function persist() {
  if (!LIKES_FILE || writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const tmp = LIKES_FILE + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(likes));
      fs.renameSync(tmp, LIKES_FILE);
    } catch (e) { console.error("like persist failed:", e.message); }
  }, 1500);
}
process.on("SIGTERM", () => {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  if (LIKES_FILE) { try { fs.writeFileSync(LIKES_FILE, JSON.stringify(likes)); } catch (e) {} }
  process.exit(0);
});

// A page is likeable only if it actually exists as a static page here.
// This stops arbitrary keys being injected into the store.
const SLUG_RE = /^\/[a-z0-9][a-z0-9-]{0,63}$/;
function validPage(p) {
  if (typeof p !== "string" || !SLUG_RE.test(p)) return false;
  const f = path.normalize(path.join(ROOT, p + ".html"));
  return f.startsWith(ROOT) && fs.existsSync(f);
}

// Crude per-IP write throttle: plenty for a personal site, no dependencies.
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.t > 60000) { hits.set(ip, { t: now, n: 1 }); return false; }
  rec.n += 1;
  if (hits.size > 5000) hits.clear();
  return rec.n > 40;
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  return (xf ? String(xf).split(",")[0] : req.socket.remoteAddress || "").trim();
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    // Redirect the apex to the canonical www host, preserving the full path
    // and query string. Only fires once the apex DNS points at Railway;
    // *.up.railway.app is left alone so health checks are unaffected.
    const host = (req.headers.host || "").split(":")[0].toLowerCase();
    if (host === "scarcinality.com") {
      res.writeHead(301, { Location: "https://" + CANONICAL_HOST + req.url });
      return res.end();
    }

    // ---- Like counts -------------------------------------------------
    if (req.url.split("?")[0] === "/api/likes") {
      if (!LIKES_FILE) return json(res, 503, { error: "like store unavailable" });

      if (req.method === "GET") {
        const q = new URLSearchParams(req.url.split("?")[1] || "");
        const page = q.get("page");
        if (page) return json(res, 200, { page: page, count: likes[page] || 0 });
        // whole store, plus where it lives so volume mounting can be verified
        return json(res, 200, {
          counts: likes,
          store: LIKES_FILE,
          persistent: !!LIKES_FILE && LIKES_FILE.indexOf(__dirname) !== 0,
          total: Object.values(likes).reduce((a, b) => a + b, 0)
        });
      }

      if (req.method === "POST") {
        if (throttled(clientIp(req))) return json(res, 429, { error: "slow down" });
        let body = "";
        req.on("data", (c) => {
          body += c;
          if (body.length > 2048) { req.destroy(); }
        });
        req.on("end", () => {
          let p;
          try { p = JSON.parse(body); } catch (e) { return json(res, 400, { error: "bad json" }); }
          const page = p && p.page;
          if (!validPage(page)) return json(res, 400, { error: "unknown page" });
          const delta = p.delta === -1 ? -1 : 1;
          likes[page] = Math.max(0, (likes[page] || 0) + delta);
          persist();
          json(res, 200, { page: page, count: likes[page] });
        });
        return;
      }

      res.writeHead(405, { Allow: "GET, POST" });
      return res.end();
    }

    // Proxy NASS API requests to keep the key server-side
    if (req.url.startsWith("/api/nass?")) {
      const qs = req.url.slice("/api/nass?".length);
      const params = new URLSearchParams(qs);
      params.set("key", NASS_KEY);
      params.set("format", "JSON");
      const nassUrl = "https://quickstats.nass.usda.gov/api/api_GET/?" + params.toString();
      https.get(nassUrl, (pr) => {
        res.writeHead(pr.statusCode, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        });
        pr.pipe(res);
      }).on("error", () => send(res, 502, "Upstream error"));
      return;
    }

    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    if (urlPath.length > 1 && urlPath.endsWith("/")) urlPath = urlPath.slice(0, -1);

    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");

    let ext = path.extname(filePath);
    if (!ext) {
      if (fs.existsSync(filePath + ".html")) { filePath += ".html"; ext = ".html"; }
      else if (fs.existsSync(path.join(filePath, "index.html"))) {
        filePath = path.join(filePath, "index.html"); ext = ".html";
      }
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        const nf = path.join(ROOT, "404.html");
        if (fs.existsSync(nf)) return send(res, 404, fs.readFileSync(nf), "text/html; charset=utf-8");
        return send(res, 404, "Not found");
      }
      send(res, 200, data, TYPES[ext] || "application/octet-stream");
    });
  } catch (e) {
    send(res, 500, "Server error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Scarcinality site listening on " + PORT);
});
