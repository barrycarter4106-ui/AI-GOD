// Proves a real authorization gap: Presence Service never checks whether
// a user is a member of the circle that owns a story before letting them
// join its live presence or post a reaction. Any authenticated user who
// knows (or guesses) a story_id can currently do both — even if they've
// never been invited to that circle. SCOPE.md called for Presence
// Service to validate against Story Service before accepting a
// connection; this was never actually implemented.

const test = require("node:test");
const assert = require("node:assert/strict");
const { connect } = require("./ws-client");

const PORTS = { auth: 5501, circle: 5502, story: 5503, presence: 5504 };
process.env.STORY_SERVICE_URL = `http://localhost:${PORTS.story}`; // must be set before presence/index.js loads

const authServer = require("../auth/index").createServer();
const circleServer = require("../circle/index").createServer();
const storyServer = require("../story/index").createServer();
const presenceServer = require("../presence/index").createServer();

async function api(port, method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

test.before(() => {
  authServer.listen(PORTS.auth);
  circleServer.listen(PORTS.circle);
  storyServer.listen(PORTS.story);
  presenceServer.listen(PORTS.presence);
});

test.after(() => {
  authServer.close();
  circleServer.close();
  storyServer.close();
  presenceServer.close();
});

let insiderToken, outsiderToken, storyId;

test("setup: insider creates a circle and posts a story; outsider is a real user but never joins", async () => {
  const insider = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "insider@pulse.app",
    password: "hunter2hunter2",
    handle: "insider",
  });
  insiderToken = insider.body.token;

  const outsider = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "outsider2@pulse.app",
    password: "hunter2hunter2",
    handle: "outsider2",
  });
  outsiderToken = outsider.body.token;

  const circle = await api(PORTS.circle, "POST", "/circles", { name: "Private Circle" }, insiderToken);
  const story = await api(
    PORTS.story,
    "POST",
    `/circles/${circle.body.id}/stories`,
    { media_url: "https://cdn.pulse.app/private.jpg", media_type: "image" },
    insiderToken
  );
  storyId = story.body.id;
  assert.equal(story.status, 201);
});

test("SECURITY: an outsider cannot post a reaction to a story in a circle they're not in", async () => {
  const res = await api(PORTS.presence, "POST", `/stories/${storyId}/react`, { emoji: "🔥" }, outsiderToken);
  assert.equal(res.status, 403, "outsiders must be blocked from reacting, got: " + res.status);
});

test("SECURITY: an outsider cannot join live presence on a story in a circle they're not in", async () => {
  const ws = await connect(PORTS.presence, `/presence/${storyId}`);
  const gotError = new Promise((resolve) => {
    ws.onMessage((raw) => resolve(JSON.parse(raw)));
  });
  ws.send(JSON.stringify({ type: "identify", token: outsiderToken }));
  const msg = await gotError;
  assert.equal(msg.type, "error");
  assert.equal(msg.reason, "not_a_member");
  ws.close();
});

test("Control: the actual circle member CAN react and join presence", async () => {
  const react = await api(PORTS.presence, "POST", `/stories/${storyId}/react`, { emoji: "❤️" }, insiderToken);
  assert.equal(react.status, 201);

  const ws = await connect(PORTS.presence, `/presence/${storyId}`);
  const gotPresence = new Promise((resolve) => {
    ws.onMessage((raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "presence") resolve(msg);
    });
  });
  ws.send(JSON.stringify({ type: "identify", token: insiderToken }));
  const msg = await gotPresence;
  assert.equal(msg.status, "viewing");
  ws.close();
});
