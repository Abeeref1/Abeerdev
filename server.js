import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_ORIGIN = process.env.UPSTREAM_ORIGIN || "https://9c04ecf0-b884-423e-b668-5bf796447785-00-16hu1yzaaageo.sisko.replit.dev";
const UPSTREAM_PREFIX = (process.env.UPSTREAM_PREFIX || "/crossfield-website/").replace(/\/+/g, "/");
const REPLIT_SID = process.env.REPLIT_SID || "";

const css = fs.readFileSync(path.join(__dirname, "crossfield-tier1.css"));
const js = fs.readFileSync(path.join(__dirname, "crossfield-tier1.js"));

const stripHeaders = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options"
]);

function localAsset(req, res, pathname) {
  if (pathname === "/crossfield-tier1.css") {
    res.writeHead(200, {"content-type":"text/css; charset=utf-8","cache-control":"no-store"});
    res.end(css);
    return true;
  }
  if (pathname === "/crossfield-tier1.js") {
    res.writeHead(200, {"content-type":"application/javascript; charset=utf-8","cache-control":"no-store"});
    res.end(js);
    return true;
  }
  if (pathname === "/health") {
    res.writeHead(200, {"content-type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({ok:true, upstream:UPSTREAM_ORIGIN}));
    return true;
  }
  return false;
}

function upstreamPathFor(pathname) {
  if (pathname === "/") return UPSTREAM_PREFIX;
  if (pathname.startsWith(UPSTREAM_PREFIX)) return pathname;
  const base = UPSTREAM_PREFIX.endsWith("/") ? UPSTREAM_PREFIX.slice(0, -1) : UPSTREAM_PREFIX;
  return base + (pathname.startsWith("/") ? pathname : "/" + pathname);
}

function upstreamUrl(pathname, search, usePrefix = true) {
  const p = usePrefix ? upstreamPathFor(pathname) : pathname;
  const u = new URL(p + search, UPSTREAM_ORIGIN);
  if (REPLIT_SID && !u.searchParams.has("replit_sid")) u.searchParams.set("replit_sid", REPLIT_SID);
  return u;
}

function requestHeaders(req) {
  const h = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || ["host","connection","content-length","accept-encoding"].includes(key.toLowerCase())) continue;
    h.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  h.set("accept-encoding", "identity");
  h.set("x-forwarded-host", req.headers.host || "");
  h.set("x-forwarded-proto", "https");
  return h;
}

async function bodyFor(req) {
  if (["GET","HEAD"].includes(req.method || "GET")) return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function rewriteLocation(location, host) {
  if (!location) return location;
  try {
    const u = new URL(location, UPSTREAM_ORIGIN);
    if (u.origin === new URL(UPSTREAM_ORIGIN).origin) {
      return "https://" + host + u.pathname + u.search + u.hash;
    }
  } catch {}
  return location;
}

function injectPresentation(html) {
  const style = '<link rel="stylesheet" href="/crossfield-tier1.css" data-crossfield-tier1>';
  const script = '<script src="/crossfield-tier1.js" defer data-crossfield-tier1></script>';
  if (!html.includes("data-crossfield-tier1")) {
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, style + "</head>");
    else html = style + html;
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, script + "</body>");
    else html += script;
  }
  return html;
}

async function proxy(req, res) {
  const incoming = new URL(req.url || "/", "http://preview.local");
  if (localAsset(req, res, incoming.pathname)) return;

  const body = await bodyFor(req);
  let target = upstreamUrl(incoming.pathname, incoming.search, true);
  let upstream;

  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: requestHeaders(req),
      body,
      redirect: "manual"
    });

    if (upstream.status === 404 && incoming.pathname !== "/" && !incoming.pathname.startsWith(UPSTREAM_PREFIX)) {
      const retry = upstreamUrl(incoming.pathname, incoming.search, false);
      const fallback = await fetch(retry, {
        method: req.method,
        headers: requestHeaders(req),
        body,
        redirect: "manual"
      });
      if (fallback.status !== 404) upstream = fallback;
    }
  } catch (error) {
    res.writeHead(502, {"content-type":"text/html; charset=utf-8"});
    res.end('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Crossfield preview upstream unavailable</h1><p>The design preview server is running, but the Replit source site did not respond.</p><pre>' + String(error).replace(/[<>&]/g, "") + '</pre></body></html>');
    return;
  }

  const headers = {};
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (stripHeaders.has(lower)) return;
    if (lower === "location") headers[key] = rewriteLocation(value, req.headers.host || "");
    else headers[key] = value;
  });
  headers["cache-control"] = "no-store";

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = injectPresentation(await upstream.text());
    headers["content-type"] = "text/html; charset=utf-8";
    res.writeHead(upstream.status, headers);
    res.end(html);
    return;
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, headers);
  res.end(bytes);
}

http.createServer((req, res) => {
  proxy(req, res).catch(err => {
    res.writeHead(500, {"content-type":"text/plain; charset=utf-8"});
    res.end("Preview error: " + String(err));
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log("Crossfield Tier-1 preview listening on " + PORT);
});
