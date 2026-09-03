// Cross-service circle-membership check — same class of bug as
// authClient.js. Circle owns CircleMember records in its own db.members;
// Story (and Presence, if it ever needs this) can't see them by checking
// a local map that was never populated here. Circle is the source of
// truth, so ask it directly. Per SCOPE.md: "Story Service — Talks to:
// Circle Service (membership checks before allowing post/view)".
//
// GET /circles/:id on Circle already requires auth *and* membership,
// returning 200 only when the caller is a member of that circle — reused
// here rather than adding a second, redundant membership endpoint.
const http = require("http");

function isCircleMember(circleId, token) {
  return new Promise((resolve) => {
    if (!token || !circleId) return resolve(false);

    let base;
    try {
      base = new URL(process.env.CIRCLE_SERVICE_URL || "http://localhost:4002");
    } catch (_) {
      return resolve(false);
    }

    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port || 80,
        path: `/circles/${encodeURIComponent(circleId)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        res.resume(); // drain the body — only the status matters here
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.end();
  });
}

module.exports = { isCircleMember };
