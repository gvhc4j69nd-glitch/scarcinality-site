// Scarcinality — minimal zero-dependency static server.
// Serves ./public, supports extensionless URLs (/treatise -> /treatise.html),
// and binds to the port Railway provides.

const http = require("http");
const fs = require("fs");
const path = require("path");

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

const server = http.createServer((req, res) => {
  try {
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
