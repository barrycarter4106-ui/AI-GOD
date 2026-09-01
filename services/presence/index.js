// Presence Service
// Owns: PresenceEvent, Reaction (ephemeral, in-memory here — swap for
// Redis before this handles more than local/seed-test traffic)
// Scope: services/presence/SCOPE.md
// Open-decision defaults applied — see DECISIONS_PROPOSED.md:
//   - 30s reconnect grace period before flipping to "left" (confirmed)
//   - Fixed 6-emoji reaction set (no free text) (confirmed)

const http = require("http");
const url = require("url");
const { attachWebSocketServer } = require("../_shared/ws-lite");
const { matchRoute, sendJSON, readBody, authHeader } = require("../_shared/http");
const { userFromToken } = require("../_shared/store");

const RECONNECT_GRACE_MS = 30_000; // confirmed by product owner — see DECISIONS.md
const ALLOWED_EMOJI = ["❤️", "😂", "😮", "🔥", "👏", "😢"]; // proposed default

const CONCURRENT_VIEWER_CEILING = 200; // resolved decision, per SCOPE.md

// story_id -> Map<user_id, { ws, leaveTimer }>
const rooms = new Map();

function getRoom(storyId) {
  if (!rooms.has(storyId)) rooms.set(storyId, new Map());
  return rooms.get(storyId);
}

function broadcast(storyId, event) {
  const room = getRoom(storyId);
  const message = JSON.stringify(event);
  for (const { ws } of room.values()) {
    try {
      ws.send(message);
    } catch (_) {
      /* connection likely already closing */
    }
  }
}

function joinPresence(storyId, userId, ws) {
  const room = getRoom(storyId);

  if (room.size >= CONCURRENT_VIEWER_CEILING && !room.has(userId)) {
    ws.send(JSON.stringify({ type: "error", reason: "story_at_capacity" }));
    ws.close();
    return false;
  }

  const existing = room.get(userId);
  if (existing && existing.leaveTimer) {
    // Reconnect within grace period — cancel the pending "left" event.
    clearTimeout(existing.leaveTimer);
  }

  room.set(userId, { ws, leaveTimer: null });
  broadcast(storyId, { type: "presence", status: "viewing", user_id: userId, viewer_count: room.size });
  return true;
}

function leavePresence(storyId, userId) {
  const room = getRoom(storyId);
  const entry = room.get(userId);
  if (!entry) return;

  // Grace period: don't broadcast "left" immediately — mobile
  // connections drop/reconnect often (network switches, etc). See
  // DECISIONS_PROPOSED.md for reasoning.
  entry.leaveTimer = setTimeout(() => {
    room.delete(userId);
    broadcast(storyId, { type: "presence", status: "left", user_id: userId, viewer_count: room.size });
    if (room.size === 0) rooms.delete(storyId);
  }, RECONNECT_GRACE_MS);
  entry.leaveTimer.unref(); // don't let this pending timer keep the process alive —
  // found during code review: test runs were hanging ~30s waiting for this
  // timer to fire even after the server closed. Also a minor resource-leak
  // risk under real load with many concurrent leave events.
}

function reactionHandler(req, res, params) {
  return (async () => {
    const token = authHeader(req);
    const user = token && userFromToken(token);
    if (!user) return sendJSON(res, 401, { error: "authentication required" });

    const body = await readBody(req);
    if (!ALLOWED_EMOJI.includes(body.emoji)) {
      return sendJSON(res, 400, { error: `emoji must be one of: ${ALLOWED_EMOJI.join(" ")}` });
    }

    broadcast(params.id, {
      type: "reaction",
      story_id: params.id,
      user_id: user.id,
      emoji: body.emoji,
      created_at: new Date().toISOString(),
    });
    return sendJSON(res, 201, { ok: true });
  })();
}

function createServer() {
  const server = http.createServer((req, res) => {
    const { pathname } = url.parse(req.url);
    let params;
    if (req.method === "POST" && (params = matchRoute("/stories/:id/react", pathname))) {
      return reactionHandler(req, res, params);
    }
    if (req.method === "GET" && matchRoute("/health", pathname)) {
      return sendJSON(res, 200, { ok: true, rooms: rooms.size });
    }
    sendJSON(res, 404, { error: "not found" });
  });

  attachWebSocketServer(
    server,
    "/presence/:story_id",
    (ws, params) => {
      // Client identifies itself with a token in the first message rather
      // than the upgrade request — simpler and works across all client
      // libraries without relying on custom headers surviving the upgrade.
      let userId = null;

      ws.onMessage = (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch (_) {
          return;
        }
        if (msg.type === "identify" && msg.token) {
          const user = userFromToken(msg.token);
          if (!user) {
            ws.send(JSON.stringify({ type: "error", reason: "invalid_token" }));
            ws.close();
            return;
          }
          userId = user.id;
          joinPresence(params.story_id, userId, ws);
        }
      };

      ws.onClose = () => {
        if (userId) leavePresence(params.story_id, userId);
      };
    },
    matchRoute
  );

  return server;
}

module.exports = { createServer, ALLOWED_EMOJI, RECONNECT_GRACE_MS, CONCURRENT_VIEWER_CEILING };

if (require.main === module) {
  const PORT = process.env.PRESENCE_PORT || 4004;
  createServer().listen(PORT, () => console.log(`Presence Service listening on ${PORT}`));
}
