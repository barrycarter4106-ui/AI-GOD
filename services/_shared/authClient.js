// Cross-service token verification.
//
// Each service's _shared/store.js `db` is a plain object scoped to that
// process — Auth, Circle, Story, and Presence each get their own copy in
// memory. A token minted by Auth's issueToken() only ever exists in
// Auth's db.sessions; no other service can resolve it by looking in its
// own (empty) map. Per the service SCOPE docs, Circle/Story/Presence are
// meant to verify identity by talking to Auth, not by sharing its memory
// — this does that over HTTP instead.
const http = require("http");

function verifyToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve(null);

    let base;
    try {
      base = new URL(process.env.AUTH_SERVICE_URL || "http://localhost:4001");
    } catch (_) {
      return resolve(null);
    }

    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port || 80,
        path: "/auth/verify",
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(data).user || null);
          } catch (_) {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

module.exports = { verifyToken };
