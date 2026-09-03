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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";
    req.on("data", (c) => (chunks += c));
    req.on("end", () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
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
