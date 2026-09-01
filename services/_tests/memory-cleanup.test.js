// Proves the memory-leak fix: expired sessions and stories must actually
// be removed from memory by cleanupExpired(), not just filtered at read
// time. Found during continued testing — see _shared/store.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const { db, uuid, nowISO, cleanupExpired } = require("../_shared/store");

test("cleanupExpired removes sessions past their expiry", () => {
  const userId = uuid();
  db.users.set(userId, { id: userId, handle: "leaktest" });
  const token = "expired-test-token";
  db.sessions.set(token, { userId, expiresAt: Date.now() - 1000 }); // already expired

  assert.ok(db.sessions.has(token), "sanity check: session exists before cleanup");
  cleanupExpired();
  assert.ok(!db.sessions.has(token), "expired session must be removed by cleanup, not just filtered on read");
});

test("cleanupExpired leaves valid sessions alone", () => {
  const userId = uuid();
  db.users.set(userId, { id: userId, handle: "validtest" });
  const token = "valid-test-token";
  db.sessions.set(token, { userId, expiresAt: Date.now() + 100000 });

  cleanupExpired();
  assert.ok(db.sessions.has(token), "a still-valid session must not be removed");
});

test("cleanupExpired removes expired stories and their contributions", () => {
  const circleId = uuid();
  const storyId = uuid();
  const contribId = uuid();
  db.stories.set(storyId, {
    id: storyId,
    circle_id: circleId,
    expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
  });
  db.contributions.set(contribId, { id: contribId, story_id: storyId });

  cleanupExpired();
  assert.ok(!db.stories.has(storyId), "expired story must be removed");
  assert.ok(!db.contributions.has(contribId), "orphaned contribution must be cleaned up with its parent story");
});

test("cleanupExpired leaves active stories alone", () => {
  const storyId = uuid();
  db.stories.set(storyId, {
    id: storyId,
    circle_id: uuid(),
    expires_at: new Date(Date.now() + 100000).toISOString(),
  });

  cleanupExpired();
  assert.ok(db.stories.has(storyId), "a still-active story must not be removed");
});
