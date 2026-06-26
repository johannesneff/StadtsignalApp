// Stadtsignal — lokaler Dev-Server (nur für die lokale Entwicklung).
// Liefert die statischen Dateien aus UND führt die Vercel-Funktion
// `api/agent.js` für POST /api/agent aus, damit der echte Agent lokal läuft.
// Start:  node dev-server.mjs   (oder: npm run dev)
// Keys:   GEMINI_API_KEY (Agent) und optional RESEND_API_KEY (Newsletter) in .env.
// Kein Vercel-Konto nötig.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;

// .env laden (einfaches KEY=VALUE), ohne bestehende Variablen zu überschreiben.
const envPath = path.join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer(async (req, res) => {
  // --- API: jede Vercel-Funktion unter /api/<name> bedienen ---
  const apiMatch = req.url.split("?")[0].match(/^\/api\/([a-z0-9_-]+)$/i);
  if (apiMatch) {
    const query = Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }

    const vReq = { method: req.method, body, query, headers: req.headers };
    const vRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(obj) {
        res.writeHead(this.statusCode, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(obj));
      },
    };
    try {
      const mod = await import(`./api/${apiMatch[1]}.js`);
      await mod.default(vReq, vRes);
    } catch (err) {
      res.writeHead(err?.code === "ERR_MODULE_NOT_FOUND" ? 404 : 500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
    }
    return;
  }

  // --- Statische Dateien ---
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});

server.listen(PORT, () => {
  const hasKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const agent = hasKey ? "aktiv (Google Gemini)" : "Fallback – kein GEMINI_API_KEY";
  console.log(`\n  Stadtsignal: http://localhost:${PORT}`);
  console.log(`  Agent: ${agent}\n`);
});
