// Circle Service
// Owns: Circle, CircleMember; invite token generation/validation
// Scope: services/circle/SCOPE.md

const http = require("http");
const crypto = require("crypto");
const url = require("url");
const { db, uuid, nowISO, circleMembers, isMember } = require("../_shared/store");
const { sendJSON, readBody, authHeader, matchRoute } = require("../_shared/http");
const { verifyToken } = require("../_shared/authClient");
const { notify } = require("../notification");

async function requireAuth(req, res) {
  const token = authHeader(req);
  const user = token && (await verifyToken(token));
  if (!user) {
    sendJSON(res, 401, { error: "authentication required" });
    return null;
  }
  return user;
}

async function handleCreateCircle(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  if (!body.name) return sendJSON(res, 400, { error: "name is required" });

  const circle = {
    id: uuid(),
    name: body.name,
    owner_id: user.id,
    theme: null,
    created_at: nowISO(),
    invite_token: crypto.randomBytes(12).toString("hex"),
  };
  db.circles.set(circle.id, circle);
  db.members.set(`${circle.id}:${user.id}`, {
    circle_id: circle.id,
    user_id: user.id,
    joined_at: nowISO(),
    role: "owner",
  });
  return sendJSON(res, 201, circle);
}

async function handleGetCircle(req, res, params) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const circle = db.circles.get(params.id);
  if (!circle) return sendJSON(res, 404, { error: "circle not found" });
  if (!isMember(circle.id, user.id)) return sendJSON(res, 403, { error: "not a member of this circle" });
  return sendJSON(res, 200, { ...circle, members: circleMembers(circle.id).length });
}

async function handleInvite(req, res, params) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const circle = db.circles.get(params.id);
  if (!circle) return sendJSON(res, 404, { error: "circle not found" });
  if (circle.owner_id !== user.id) return sendJSON(res, 403, { error: "only the owner can generate invites" });

  // Rotate token — spec: single active token per circle
  circle.invite_token = crypto.randomBytes(12).toString("hex");
  db.circles.set(circle.id, circle);
  return sendJSON(res, 200, { invite_link: `pulse://join/${circle.invite_token}` });
}

async function handleJoin(req, res, params) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const circle = [...db.circles.values()].find((c) => c.invite_token === params.token);
  if (!circle) return sendJSON(res, 404, { error: "invalid or expired invite" });

  if (!isMember(circle.id, user.id)) {
    db.members.set(`${circle.id}:${user.id}`, {
      circle_id: circle.id,
      user_id: user.id,
      joined_at: nowISO(),
      role: "member",
    });
    // Per SCOPE.md: Notification Service "Talks to: Circle Service
    // (invite notifications)" — let the owner know their circle grew.
    notify(circle.owner_id, "circle_invite", {
      circle_id: circle.id,
      circle_name: circle.name,
      joined_user_id: user.id,
    });
  }
  return sendJSON(res, 200, circle);
}

async function handleListMembers(req, res, params) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const circle = db.circles.get(params.id);
  if (!circle) return sendJSON(res, 404, { error: "circle not found" });
  if (!isMember(circle.id, user.id)) return sendJSON(res, 403, { error: "not a member of this circle" });
  return sendJSON(res, 200, { member_ids: circleMembers(circle.id).map((m) => m.user_id) });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname } = url.parse(req.url);
    let params;
    try {
      if (req.method === "POST" && matchRoute("/circles", pathname)) {
        return await handleCreateCircle(req, res);
      }
      if (req.method === "GET" && (params = matchRoute("/circles/:id", pathname))) {
        return await handleGetCircle(req, res, params);
      }
      if (req.method === "GET" && (params = matchRoute("/circles/:id/members", pathname))) {
        return await handleListMembers(req, res, params);
      }
      if (req.method === "POST" && (params = matchRoute("/circles/:id/invite", pathname))) {
        return await handleInvite(req, res, params);
      }
      if (req.method === "POST" && (params = matchRoute("/circles/join/:token", pathname))) {
        return await handleJoin(req, res, params);
      }
      sendJSON(res, 404, { error: "not found" });
    } catch (err) {
      sendJSON(res, 500, { error: "internal error", detail: err.message });
    }
  });
}

module.exports = { createServer };

if (require.main === module) {
  const PORT = process.env.CIRCLE_PORT || 4002;
  createServer().listen(PORT, () => console.log(`Circle Service listening on ${PORT}`));
}
