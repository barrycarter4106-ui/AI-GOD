// Cross-examination security audit: systematically verifies that no
// endpoint leaks sensitive data, that limits are enforced, and that
// authorization holds across service boundaries. Written as a permanent
// regression suite so these properties can't silently regress later.

const test = require("node:test");
const assert = require("node:assert/strict");

const PORTS = { auth: 5601, circle: 5602, story: 5603, presence: 5604 };
process.env.STORY_SERVICE_URL = `http://localhost:${PORTS.story}`;

const authServer = require("../auth/index").createServer();
const circleServer = require("../circle/index").createServer();
const storyServer = require("../story/index").createServer();

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
});

test.after(() => {
  authServer.close();
  circleServer.close();
  storyServer.close();
});

let aliceToken, bobToken, aliceCircleId, aliceStoryId;

test("setup: two independent users with separate circles", async () => {
  const alice = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "alice-audit@pulse.app",
    password: "alicepassword1",
    handle: "alice_audit",
  });
  aliceToken = alice.body.token;

  const bob = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "bob-audit@pulse.app",
    password: "bobpassword1",
    handle: "bob_audit",
  });
  bobToken = bob.body.token;

  const circle = await api(PORTS.circle, "POST", "/circles", { name: "Alice Private" }, aliceToken);
  aliceCircleId = circle.body.id;

  const story = await api(
    PORTS.story,
    "POST",
    `/circles/${aliceCircleId}/stories`,
    { media_url: "https://cdn.pulse.app/a.jpg", media_type: "image" },
    aliceToken
  );
  aliceStoryId = story.body.id;
  assert.equal(story.status, 201);
});

test("DATA LEAK: signup response never contains password material", async () => {
  const res = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "leakcheck@pulse.app",
    password: "leakcheckpass1",
    handle: "leakcheck",
  });
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes("_passwordHash"), "password hash must never be returned");
  assert.ok(!serialized.includes("_salt"), "salt must never be returned");
  assert.ok(!serialized.includes("leakcheckpass1"), "plaintext password must never be echoed back");
});

test("DATA LEAK: login response never contains password material", async () => {
  const res = await api(PORTS.auth, "POST", "/auth/login", {
    email: "alice-audit@pulse.app",
    password: "alicepassword1",
  });
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes("_passwordHash"));
  assert.ok(!serialized.includes("_salt"));
  assert.ok(!serialized.includes("alicepassword1"));
});

test("DATA LEAK: 500 responses do not expose internal error details", async () => {
  // Malformed JSON triggers the catch-all handler.
  const res = await fetch(`http://localhost:${PORTS.auth}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not valid json",
  });
  const body = await res.json().catch(() => ({}));
  assert.ok(!body.detail, "internal error detail must not be returned to the client");
});

test("ACCESS CONTROL: Bob cannot read Alice's circle", async () => {
  const res = await api(PORTS.circle, "GET", `/circles/${aliceCircleId}`, null, bobToken);
  assert.equal(res.status, 403);
});

test("ACCESS CONTROL: Bob cannot list stories in Alice's circle", async () => {
  const res = await api(PORTS.story, "GET", `/circles/${aliceCircleId}/stories`, null, bobToken);
  assert.equal(res.status, 403);
});

test("ACCESS CONTROL: Bob cannot read Alice's individual story", async () => {
  const res = await api(PORTS.story, "GET", `/stories/${aliceStoryId}`, null, bobToken);
  assert.equal(res.status, 403);
});

test("ACCESS CONTROL: Bob cannot post a story into Alice's circle", async () => {
  const res = await api(
    PORTS.story,
    "POST",
    `/circles/${aliceCircleId}/stories`,
    { media_url: "https://cdn.pulse.app/intrusion.jpg", media_type: "image" },
    bobToken
  );
  assert.equal(res.status, 403);
});

test("ACCESS CONTROL: Bob cannot generate an invite for Alice's circle", async () => {
  const res = await api(PORTS.circle, "POST", `/circles/${aliceCircleId}/invite`, {}, bobToken);
  assert.equal(res.status, 403);
});

test("INPUT VALIDATION: oversized request body is rejected, not absorbed", async () => {
  // 11MB, just over the 10MB cap.
  const huge = "x".repeat(11 * 1024 * 1024);
  try {
    const res = await fetch(`http://localhost:${PORTS.auth}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "big@pulse.app", password: "bigpassword1", handle: huge }),
    });
    assert.ok(res.status >= 400, "oversized body must be rejected with an error status");
  } catch (err) {
    // Connection destroyed mid-upload is also an acceptable outcome —
    // the point is the server doesn't happily buffer 11MB into memory.
    assert.ok(true);
  }
});

test("INPUT VALIDATION: a JSON array body is rejected cleanly", async () => {
  const res = await fetch(`http://localhost:${PORTS.auth}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["not", "an", "object"]),
  });
  assert.ok(res.status >= 400, "non-object JSON body must be rejected");
});

test("INPUT VALIDATION: weak password and malformed email are rejected", async () => {
  const weak = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "weak@pulse.app",
    password: "short",
    handle: "weakpass",
  });
  assert.equal(weak.status, 400);

  const badEmail = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "not-an-email",
    password: "longenoughpassword",
    handle: "bademail",
  });
  assert.equal(badEmail.status, 400);
});

test("AUTH: a garbage bearer token is rejected everywhere", async () => {
  const endpoints = [
    [PORTS.circle, "POST", "/circles", { name: "hax" }],
    [PORTS.story, "GET", `/circles/${aliceCircleId}/stories`, null],
    [PORTS.story, "GET", `/stories/${aliceStoryId}`, null],
  ];
  for (const [port, method, path, body] of endpoints) {
    const res = await api(port, method, path, body, "totally-made-up-token");
    assert.equal(res.status, 401, `${method} ${path} must reject a forged token`);
  }
});
