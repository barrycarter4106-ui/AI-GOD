// Run with: node --test services/_tests/backend.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const AUTH_PORT = 5101, CIRCLE_PORT = 5102, STORY_PORT = 5103;

// Circle/Story verify tokens by calling Auth over HTTP (see
// services/_shared/authClient.js), and Story checks circle membership
// by calling Circle (see services/_shared/circleClient.js) — point both
// at this test's own instances before any requests are made.
process.env.AUTH_SERVICE_URL = `http://localhost:${AUTH_PORT}`;
process.env.CIRCLE_SERVICE_URL = `http://localhost:${CIRCLE_PORT}`;

const authServer = require("../auth/index").createServer();
const circleServer = require("../circle/index").createServer();
const storyServer = require("../story/index").createServer();

async function request(port, method, path, body, token) {
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
  authServer.listen(AUTH_PORT);
  circleServer.listen(CIRCLE_PORT);
  storyServer.listen(STORY_PORT);
});

test.after(() => {
  authServer.close();
  circleServer.close();
  storyServer.close();
});

let token, circleId, inviteLink;

test("Auth: signup creates a user and returns a token", async () => {
  const { status, body } = await request(AUTH_PORT, "POST", "/auth/signup", {
    email: "test@pulse.app",
    password: "hunter2hunter2",
    handle: "testuser",
  });
  assert.equal(status, 201);
  assert.ok(body.token);
  assert.equal(body.user.handle, "testuser");
  assert.equal(body.user.password, undefined, "password must never be returned");
  token = body.token;
});

test("Auth: signup rejects duplicate handle/email", async () => {
  const { status } = await request(AUTH_PORT, "POST", "/auth/signup", {
    email: "test@pulse.app",
    password: "hunter2hunter2",
    handle: "testuser",
  });
  assert.equal(status, 409);
});

test("Auth: login works with correct credentials", async () => {
  const { status, body } = await request(AUTH_PORT, "POST", "/auth/login", {
    email: "test@pulse.app",
    password: "hunter2hunter2",
  });
  assert.equal(status, 200);
  assert.ok(body.token);
});

test("Auth: login rejects wrong password", async () => {
  const { status } = await request(AUTH_PORT, "POST", "/auth/login", {
    email: "test@pulse.app",
    password: "wrongpassword",
  });
  assert.equal(status, 401);
});

test("Circle: requires auth to create", async () => {
  const { status } = await request(CIRCLE_PORT, "POST", "/circles", { name: "Trip" });
  assert.equal(status, 401);
});

test("Circle: authenticated user can create a circle", async () => {
  const { status, body } = await request(CIRCLE_PORT, "POST", "/circles", { name: "Spring Break" }, token);
  assert.equal(status, 201);
  assert.equal(body.name, "Spring Break");
  circleId = body.id;
});

test("Circle: owner can generate an invite link", async () => {
  const { status, body } = await request(CIRCLE_PORT, "POST", `/circles/${circleId}/invite`, {}, token);
  assert.equal(status, 200);
  assert.ok(body.invite_link.startsWith("pulse://join/"));
  inviteLink = body.invite_link;
});

test("Circle: a second user can join via invite link", async () => {
  const signup = await request(AUTH_PORT, "POST", "/auth/signup", {
    email: "friend@pulse.app",
    password: "hunter2hunter2",
    handle: "frienduser",
  });
  const friendToken = signup.body.token;
  const inviteToken = inviteLink.split("/").pop();
  const { status, body } = await request(CIRCLE_PORT, "POST", `/circles/join/${inviteToken}`, {}, friendToken);
  assert.equal(status, 200);
  assert.equal(body.id, circleId);
});

test("Story: member can post a story to their circle", async () => {
  const { status, body } = await request(
    STORY_PORT,
    "POST",
    `/circles/${circleId}/stories`,
    { media_url: "https://cdn.pulse.app/abc.jpg", media_type: "image" },
    token
  );
  assert.equal(status, 201);
  assert.equal(body.circle_id, circleId);
  assert.ok(new Date(body.expires_at) > new Date());
});

test("Story: non-member cannot post to a circle", async () => {
  const signup = await request(AUTH_PORT, "POST", "/auth/signup", {
    email: "outsider@pulse.app",
    password: "hunter2hunter2",
    handle: "outsider",
  });
  const { status } = await request(
    STORY_PORT,
    "POST",
    `/circles/${circleId}/stories`,
    { media_url: "https://cdn.pulse.app/x.jpg", media_type: "image" },
    signup.body.token
  );
  assert.equal(status, 403);
});

test("Story: collaborative story accepts contributions from other members", async () => {
  const post = await request(
    STORY_PORT,
    "POST",
    `/circles/${circleId}/stories`,
    { media_url: "https://cdn.pulse.app/collab.jpg", media_type: "image", is_collaborative: true },
    token
  );
  assert.equal(post.status, 201);

  const login = await request(AUTH_PORT, "POST", "/auth/login", {
    email: "friend@pulse.app",
    password: "hunter2hunter2",
  });

  const contrib = await request(
    STORY_PORT,
    "POST",
    `/stories/${post.body.id}/contributions`,
    { media_url: "https://cdn.pulse.app/friend-added.jpg" },
    login.body.token
  );
  assert.equal(contrib.status, 201);
  assert.equal(contrib.body.story_id, post.body.id);
});

test("Story: list only returns non-expired stories to members", async () => {
  const { status, body } = await request(STORY_PORT, "GET", `/circles/${circleId}/stories`, null, token);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 2);
});
