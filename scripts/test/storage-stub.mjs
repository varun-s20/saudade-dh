/**
 * A small in-memory stand-in for Supabase Storage, for local and CI integration tests only
 * (npm run test:api). It speaks the subset of the Storage REST API that @supabase/storage-js uses
 * here: buckets, signed upload URLs (browser PUT, with CORS), object info, signed read URLs with
 * Range support, server upload/download, delete and list. Every object lives in memory and is
 * gone when the process exits. It checks nothing about the service key: never expose it.
 *
 *   node scripts/test/storage-stub.mjs [--port 54330]
 *   SUPABASE_URL=http://127.0.0.1:54330  SUPABASE_SERVICE_ROLE_KEY=anything
 *
 * Responses follow the real API's shapes closely enough for this app; it is not a full emulator.
 */
import { randomBytes } from "node:crypto";
import http from "node:http";

const argv = process.argv.slice(2);
const PORT = Number(argv.includes("--port") ? argv[argv.indexOf("--port") + 1] : process.env.STORAGE_STUB_PORT || 54330);
const PREFIX = "/storage/v1";

/** bucket → Map<key, { bytes: Buffer, type: string, created: string }> */
const buckets = new Map();
/** token → { bucket, key, kind: "upload" | "read", expires } */
const tokens = new Map();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, PUT, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-upsert, cache-control, range, x-client-info",
  "access-control-expose-headers": "content-length, content-range, etag",
};

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = body === undefined ? "" : isBuf ? body : JSON.stringify(body);
  res.writeHead(status, { ...CORS, ...(isBuf ? {} : { "content-type": "application/json" }), ...headers });
  res.end(payload);
}
const error = (res, status, message) => send(res, status, { statusCode: String(status), error: status === 404 ? "not_found" : "Error", message });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const json = async (req) => {
  const b = await readBody(req);
  return b.length ? JSON.parse(b.toString("utf8")) : {};
};

function newToken(bucket, key, kind, ttlSec) {
  const t = randomBytes(18).toString("base64url");
  tokens.set(t, { bucket, key, kind, expires: Date.now() + ttlSec * 1000 });
  return t;
}

function takeToken(t, bucket, key, kind) {
  const rec = t ? tokens.get(t) : null;
  if (!rec || rec.bucket !== bucket || rec.key !== key || rec.kind !== kind || rec.expires < Date.now()) return false;
  if (kind === "upload") tokens.delete(t); // single use
  return true;
}

/** "media/incoming/u/m" → ["media", "incoming/u/m"] */
function splitPath(rest) {
  const parts = decodeURIComponent(rest).replace(/^\/+/, "").split("/");
  return [parts[0], parts.slice(1).join("/")];
}

function store(bucket) {
  if (!buckets.has(bucket)) return null;
  return buckets.get(bucket);
}

function put(res, bucket, key, bytes, type, upsert) {
  const s = store(bucket);
  if (!s) return error(res, 404, "Bucket not found");
  if (s.has(key) && !upsert) return error(res, 409, "The resource already exists");
  s.set(key, { bytes, type: type || "application/octet-stream", created: new Date().toISOString() });
  return send(res, 200, { Key: `${bucket}/${key}`, Id: randomBytes(8).toString("hex") });
}

function serveObject(req, res, obj) {
  const total = obj.bytes.length;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(total - 1, Number(range[2])) : total - 1;
    return send(res, 206, obj.bytes.subarray(start, end + 1), {
      "content-type": obj.type,
      "content-range": `bytes ${start}-${end}/${total}`,
      "accept-ranges": "bytes",
    });
  }
  return send(res, 200, req.method === "HEAD" ? Buffer.alloc(0) : obj.bytes, { "content-type": obj.type, "content-length": String(total), "accept-ranges": "bytes" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "OPTIONS") return send(res, 204);
    if (!url.pathname.startsWith(PREFIX)) return error(res, 404, "not found");
    const p = url.pathname.slice(PREFIX.length);

    // ── Buckets ──
    if (p === "/bucket" && req.method === "GET") return send(res, 200, [...buckets.keys()].map((id) => ({ id, name: id, public: false })));
    if (p === "/bucket" && req.method === "POST") {
      const b = await json(req);
      const id = b.id ?? b.name;
      if (!buckets.has(id)) buckets.set(id, new Map());
      return send(res, 200, { name: id });
    }
    let m = /^\/bucket\/([^/]+)$/.exec(p);
    if (m && req.method === "GET") return buckets.has(m[1]) ? send(res, 200, { id: m[1], name: m[1], public: false }) : error(res, 404, "Bucket not found");

    // ── Signed uploads ──
    if ((m = /^\/object\/upload\/sign\/(.+)$/.exec(p))) {
      const [bucket, key] = splitPath(m[1]);
      if (req.method === "POST") {
        if (!store(bucket)) return error(res, 404, "Bucket not found");
        const t = newToken(bucket, key, "upload", 7200);
        return send(res, 200, { url: `/object/upload/sign/${bucket}/${key}?token=${t}` });
      }
      if (req.method === "PUT") {
        if (!takeToken(url.searchParams.get("token"), bucket, key, "upload")) return error(res, 400, "invalid or used upload token");
        return put(res, bucket, key, await readBody(req), req.headers["content-type"], req.headers["x-upsert"] === "true");
      }
    }

    // ── Info ──
    if ((m = /^\/object\/info\/(.+)$/.exec(p)) && req.method === "GET") {
      const [bucket, key] = splitPath(m[1]);
      const obj = store(bucket)?.get(key);
      if (!obj) return error(res, 404, "Object not found");
      return send(res, 200, { name: key, size: obj.bytes.length, content_type: obj.type, created_at: obj.created, updated_at: obj.created });
    }

    // ── Signed reads ──
    if ((m = /^\/object\/sign\/(.+)$/.exec(p))) {
      const [bucket, key] = splitPath(m[1]);
      if (req.method === "POST" && !key) {
        const b = await json(req);
        return send(
          res,
          200,
          (b.paths ?? []).map((k) =>
            store(bucket)?.has(k)
              ? { path: k, signedURL: `/object/sign/${bucket}/${k}?token=${newToken(bucket, k, "read", b.expiresIn ?? 60)}`, error: null }
              : { path: k, signedURL: null, error: "Either the object does not exist or you do not have access to it" },
          ),
        );
      }
      if (req.method === "POST") {
        const b = await json(req);
        if (!store(bucket)?.has(key)) return error(res, 404, "Object not found");
        return send(res, 200, { signedURL: `/object/sign/${bucket}/${key}?token=${newToken(bucket, key, "read", b.expiresIn ?? 60)}` });
      }
      if (req.method === "GET" || req.method === "HEAD") {
        if (!takeToken(url.searchParams.get("token"), bucket, key, "read")) return error(res, 400, "invalid signature");
        const obj = store(bucket)?.get(key);
        return obj ? serveObject(req, res, obj) : error(res, 404, "Object not found");
      }
    }

    // ── List ──
    if ((m = /^\/object\/list\/([^/]+)$/.exec(p)) && req.method === "POST") {
      const b = await json(req);
      const prefix = (b.prefix ?? "").replace(/\/?$/, b.prefix ? "/" : "");
      const s = store(m[1]);
      if (!s) return error(res, 404, "Bucket not found");
      const names = new Map();
      for (const [k, o] of s) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        const [head, ...tail] = rest.split("/");
        if (tail.length) names.set(head, { name: head, id: null, metadata: null });
        else names.set(head, { name: head, id: k, metadata: { size: o.bytes.length, mimetype: o.type } });
      }
      return send(res, 200, [...names.values()].slice(b.offset ?? 0, (b.offset ?? 0) + (b.limit ?? 100)));
    }

    // ── Delete (prefixes) ──
    if ((m = /^\/object\/([^/]+)$/.exec(p)) && req.method === "DELETE") {
      const b = await json(req);
      const s = store(m[1]);
      if (!s) return error(res, 404, "Bucket not found");
      const removed = [];
      for (const k of b.prefixes ?? []) if (s.delete(k)) removed.push({ name: k });
      return send(res, 200, removed);
    }

    // ── Server-side upload / download ──
    if ((m = /^\/object\/(.+)$/.exec(p))) {
      const [bucket, key] = splitPath(m[1]);
      if (req.method === "POST" || req.method === "PUT") {
        const upsert = req.method === "PUT" || req.headers["x-upsert"] === "true";
        return put(res, bucket, key, await readBody(req), req.headers["content-type"], upsert);
      }
      if (req.method === "GET" || req.method === "HEAD") {
        const obj = store(bucket)?.get(key);
        return obj ? serveObject(req, res, obj) : error(res, 404, "Object not found");
      }
    }
    return error(res, 404, `no route for ${req.method} ${p}`);
  } catch (e) {
    return error(res, 500, e instanceof Error ? e.message : String(e));
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`storage stub on http://127.0.0.1:${PORT}${PREFIX}`));
