// Pulse — shared in-memory data store for local dev/testing.
// Per shared/types/models.ts. NOT for production use — swap for a real
// database (e.g. Postgres) before this goes anywhere near real users.

const crypto = require("crypto");

const db = {
  users: new Map(),       // id -> User
  circles: new Map(),     // id -> Circle
  members: new Map(),     // `${circleId}:${userId}` -> CircleMember
  stories: new Map(),     // id -> Story
  contributions: new Map(), // id -> StoryContribution
  sessions: new Map(),    // token -> { userId, expiresAt }
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function issueToken(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function userFromToken(token) {
  const session = db.sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    // Bug found in review: sessions never expired before this fix —
    // a token issued once worked forever. Clean up the stale entry too.
    db.sessions.delete(token);
    return null;
  }
  return db.users.get(session.userId) || null;
}

function circleMembers(circleId) {
  return [...db.members.values()].filter((m) => m.circle_id === circleId);
}

function isMember(circleId, userId) {
  return db.members.has(`${circleId}:${userId}`);
}

// Bug found in continued testing: expired sessions and expired stories
// were only ever filtered out at READ time (userFromToken checks
// expiry on lookup; Story Service filters expired stories from list
// results) — but the actual Map entries were never removed, so memory
// grows without bound for as long as the process runs. Fine for a
// short-lived local test, a real problem for anything long-running.
// Runs every 10 minutes; unref'd so it doesn't keep the process alive
// (same lesson as the Presence Service timer-leak fix).
function cleanupExpired() {
  const now = Date.now();
  for (const [token, session] of db.sessions) {
    if (now > session.expiresAt) db.sessions.delete(token);
  }
  for (const [id, story] of db.stories) {
    if (new Date(story.expires_at).getTime() <= now) {
      db.stories.delete(id);
      for (const [cid, contrib] of db.contributions) {
        if (contrib.story_id === id) db.contributions.delete(cid);
      }
    }
  }
}

const cleanupTimer = setInterval(cleanupExpired, 10 * 60 * 1000);
cleanupTimer.unref();

module.exports = { db, uuid, nowISO, issueToken, userFromToken, circleMembers, isMember, cleanupExpired };
