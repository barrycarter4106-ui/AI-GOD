const test = require("node:test");
const assert = require("node:assert/strict");
const { connect } = require("./ws-client");
const { uuid } = require("../_shared/store");

const AUTH_PORT = 5209, PORT = 5210;

// Presence verifies tokens by calling Auth over HTTP (see
// services/_shared/authClient.js) — point it at this test's Auth
// instance, and mint tokens via real signups rather than poking Auth's
// db directly (that only worked by accident, via Node's module cache,
// when everything ran in one process — see the shared-session-store fix).
process.env.AUTH_SERVICE_URL = `http://localhost:${AUTH_PORT}`;

const authServer = require("../auth/index").createServer();
const presence = require("../presence/index");
let server;

async function signup(handle) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${handle}@pulse.app`, password: "hunter2hunter2", handle }),
  });
  const body = await res.json();
  return { user: body.user, token: body.token };
}

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
  await new Promise((resolve) => authServer.listen(AUTH_PORT, resolve));
  server = presence.createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
});

test.after(() => {
  server.close();
  authServer.close();
});

test("Presence: two viewers see each other join", async () => {
  const { user: userA, token: tokenA } = await signup("presence-a");
  const { user: userB, token: tokenB } = await signup("presence-b");
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
  const { user, token } = await signup("presence-reactor");
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
  const { token } = await signup("presence-spammer");
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
