// Serves ./out like GitHub Pages does, for local checks of the browser edition.
//   node scripts/serve-static.mjs [--base /psl-arena] [--port 3300]
// "/" redirects to the base path; directories serve index.html; unknown paths get 404.html.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = (arg("--base", process.env.PSL_BASE_PATH ?? "") || "").replace(/\/+$/, "");
const port = Number(arg("--port", "3300"));
const out = join(root, process.env.PSL_STATIC_DIST ?? "out");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".task": "application/octet-stream", ".ico": "image/x-icon" };

function send(res, file, status = 200) {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (base && !path.startsWith(`${base}/`)) {
    if (path === base || path === "/") {
      res.writeHead(301, { Location: `${base}/` });
      return res.end();
    }
    return send(res, join(out, "404.html"), 404);
  }
  path = normalize(path.slice(base.length)).replace(/^(\.\.[/\\])+/, "");
  let file = join(out, path);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    file = join(file, "index.html");
  } else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) return send(res, join(out, "404.html"), 404);
  send(res, file);
}).listen(port, () => console.log(`[serve-static] http://localhost:${port}${base}/ -> ${out}`));
