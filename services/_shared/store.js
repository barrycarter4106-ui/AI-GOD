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

module.exports = { db, uuid, nowISO, issueToken, userFromToken, circleMembers, isMember };
