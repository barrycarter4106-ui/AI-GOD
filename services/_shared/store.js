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
  sessions: new Map(),    // token -> userId
};

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function issueToken(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions.set(token, userId);
  return token;
}

function userFromToken(token) {
  const userId = db.sessions.get(token);
  if (!userId) return null;
  return db.users.get(userId) || null;
}

function circleMembers(circleId) {
  return [...db.members.values()].filter((m) => m.circle_id === circleId);
}

function isMember(circleId, userId) {
  return db.members.has(`${circleId}:${userId}`);
}

module.exports = { db, uuid, nowISO, issueToken, userFromToken, circleMembers, isMember };
