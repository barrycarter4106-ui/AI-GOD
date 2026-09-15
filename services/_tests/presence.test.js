const test = require("node:test");
const assert = require("node:assert/strict");
const { connect } = require("./ws-client");
const { uuid } = require("../_shared/store");
const { getTriggeredFor } = require("../notification");

const AUTH_PORT = 5209, PORT = 5210, CIRCLE_PORT = 5211, STORY_PORT = 5212;

// Presence verifies tokens by calling Auth over HTTP (see
// services/_shared/authClient.js) — point it at this test's Auth
// instance, and mint tokens via real signups rather than poking Auth's
// db directly (that only worked by accident, via Node's module cache,
// when everything ran in one process — see the shared-session-store fix).
// The "friends watching" trigger also needs real Circle/Story instances,
// since Presence asks Story for a story's author (storyClient.js), and
// Story in turn asks Circle for membership (circleClient.js).
process.env.AUTH_SERVICE_URL = `http://localhost:${AUTH_PORT}`;
process.env.CIRCLE_SERVICE_URL = `http://localhost:${CIRCLE_PORT}`;
process.env.STORY_SERVICE_URL = `http://localhost:${STORY_PORT}`;

const authServer = require("../auth/index").createServer();
const circleServer = require("../circle/index").createServer();
const storyServer = require("../story/index").createServer();
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
  await new Promise((resolve) => circleServer.listen(CIRCLE_PORT, resolve));
  await new Promise((resolve) => storyServer.listen(STORY_PORT, resolve));
  server = presence.createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
});

test.after(() => {
  server.close();
  storyServer.close();
  circleServer.close();
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

test("Presence: notifies the story author when the first viewer joins", async () => {
  const { user: author, token: authorToken } = await signup("presence-author");
  const { user: viewer, token: viewerToken } = await signup("presence-viewer");

  const circleRes = await fetch(`http://localhost:${CIRCLE_PORT}/circles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authorToken}` },
    body: JSON.stringify({ name: "Presence Test Circle" }),
  });
  const circle = await circleRes.json();

  const inviteRes = await fetch(`http://localhost:${CIRCLE_PORT}/circles/${circle.id}/invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authorToken}` },
  });
  const { invite_link } = await inviteRes.json();
  const inviteToken = invite_link.split("/").pop();
  await fetch(`http://localhost:${CIRCLE_PORT}/circles/join/${inviteToken}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${viewerToken}` },
  });

  const storyRes = await fetch(`http://localhost:${STORY_PORT}/circles/${circle.id}/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authorToken}` },
    body: JSON.stringify({ media_url: "https://cdn.pulse.app/x.jpg", media_type: "image" }),
  });
  const story = await storyRes.json();

  const ws = await connect(PORT, `/presence/${story.id}`);
  ws.send(JSON.stringify({ type: "identify", token: viewerToken }));
  await new Promise((r) => setTimeout(r, 200)); // let identify + the async author lookup settle

  const events = getTriggeredFor(author.id).filter((e) => e.type === "friends_watching" && e.payload.story_id === story.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.viewer_id, viewer.id);

  ws.close();
});
