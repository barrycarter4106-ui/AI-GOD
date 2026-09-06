// Minimal HTTP helpers so each service doesn't need Express etc.
// Pure Node built-ins by design — see PR notes on why (no registry access
// in the build sandbox). Swap for Express/Fastify once npm access exists.

function sendJSON(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
    "X-Content-Type-Options": "nosniff",
  });
  res.end(data);
}

// SECURITY (found in cross-examination audit): this previously
// accumulated request bodies with no size cap at all — a single request
// with a multi-GB body would exhaust memory and crash the process. Very
// reachable given the frontend posts photos as base64 data URLs. Now
// capped, with the connection destroyed rather than just erroring, so a
// malicious client can't keep streaming after being rejected.
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB — generous for a base64 photo

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";
    let size = 0;
    req.on("data", (c) => {
      size += Buffer.byteLength(c);
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("request body too large"));
        return;
      }
      chunks += c;
    });
    req.on("end", () => {
      if (!chunks) return resolve({});
      try {
        const parsed = JSON.parse(chunks);
        // Reject non-object bodies (arrays, strings, numbers) — every
        // handler destructures body as an object, so a JSON array would
        // produce confusing undefined-field behavior instead of a clean 400.
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return reject(new Error("body must be a JSON object"));
        }
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Minimal CORS support so browser-based clients (the mobile app's Expo
// web target) can call these services from a different origin/port.
// Not needed for native iOS/Android — this exists purely to unblock
// local web-preview testing, since browsers enforce same-origin policy
// and none of these services otherwise answer OPTIONS.
function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

function authHeader(req) {
  const h = req.headers["authorization"] || "";
  const [, token] = h.split(" "); // "Bearer <token>"
  return token || null;
}

// Simple path matcher: "/circles/:id/stories" against "/circles/abc/stories"
function matchRoute(pattern, pathname) {
  const pParts = pattern.split("/").filter(Boolean);
  const uParts = pathname.split("/").filter(Boolean);
  if (pParts.length !== uParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(":")) {
      params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
    } else if (pParts[i] !== uParts[i]) {
      return null;
    }
  }
  return params;
}

module.exports = { sendJSON, readBody, authHeader, matchRoute, applyCors };
