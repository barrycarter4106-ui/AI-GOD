const test = require("node:test");
const assert = require("node:assert/strict");
const { connect } = require("./ws-client");
const { db, issueToken, uuid, nowISO } = require("../_shared/store");

const presence = require("../presence/index");
const PORT = 5210;
let server;

function waitFor(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for message")), timeoutMs);
    ws.onMessage((raw) => {
      const msg = JSON.parse(raw);
      if (predicate(msg)) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

test.before(async () => {
  server = presence.createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
});

test.after(() => server.close());

test("Presence: two viewers see each other join", async () => {
  const userA = { id: uuid(), handle: "a" };
  const userB = { id: uuid(), handle: "b" };
  db.users.set(userA.id, userA);
  db.users.set(userB.id, userB);
  const tokenA = issueToken(userA.id);
  const tokenB = issueToken(userB.id);
  const storyId = uuid();

  const wsA = await connect(PORT, `/presence/${storyId}`);
  const seenBJoin = waitFor(wsA, (m) => m.type === "presence" && m.user_id === userB.id && m.status === "viewing");
  wsA.send(JSON.stringify({ type: "identify", token: tokenA }));

  const wsB = await connect(PORT, `/presence/${storyId}`);
  wsB.send(JSON.stringify({ type: "identify", token: tokenB }));

  const msg = await seenBJoin;
  assert.equal(msg.viewer_count, 2);

  wsA.close();
  wsB.close();
});

test("Presence: reaction broadcasts to viewers over the WebSocket", async () => {
  const user = { id: uuid(), handle: "reactor" };
  db.users.set(user.id, user);
  const token = issueToken(user.id);
  const storyId = uuid();

  const ws = await connect(PORT, `/presence/${storyId}`);
  const gotReaction = waitFor(ws, (m) => m.type === "reaction");
  ws.send(JSON.stringify({ type: "identify", token }));
  await new Promise((r) => setTimeout(r, 100)); // let identify settle

  const res = await fetch(`http://localhost:${PORT}/stories/${storyId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emoji: "🔥" }),
  });
  assert.equal(res.status, 201);

  const msg = await gotReaction;
  assert.equal(msg.emoji, "🔥");
  assert.equal(msg.user_id, user.id);

  ws.close();
});

test("Presence: rejects an emoji outside the fixed set", async () => {
  const user = { id: uuid(), handle: "spammer" };
  db.users.set(user.id, user);
  const token = issueToken(user.id);
  const storyId = uuid();

  const res = await fetch(`http://localhost:${PORT}/stories/${storyId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emoji: "💩🎉free-text-attempt" }),
  });
  assert.equal(res.status, 400);
});

test("Presence: reaction endpoint requires authentication", async () => {
  const res = await fetch(`http://localhost:${PORT}/stories/${uuid()}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emoji: "❤️" }),
  });
  assert.equal(res.status, 401);
});
