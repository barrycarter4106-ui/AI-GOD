const test = require("node:test");
const assert = require("node:assert/strict");

const authServer = require("../auth/index").createServer();
const { db, issueToken, uuid } = require("../_shared/store");

const PORT = 5301;

async function request(method, path, body) {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

test.before(() => authServer.listen(PORT));
test.after(() => authServer.close());

test("Auth: signup rejects missing email", async () => {
  const { status, body } = await request("POST", "/auth/signup", { password: "x".repeat(10), handle: "nomail" });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test("Auth: signup rejects missing password", async () => {
  const { status } = await request("POST", "/auth/signup", { email: "nopass@pulse.app", handle: "nopass" });
  assert.equal(status, 400);
});

test("Auth: signup rejects missing handle", async () => {
  const { status } = await request("POST", "/auth/signup", { email: "nohandle@pulse.app", password: "x".repeat(10) });
  assert.equal(status, 400);
});

test("Auth: login rejects a nonexistent email", async () => {
  const { status } = await request("POST", "/auth/login", { email: "ghost@pulse.app", password: "whatever12" });
  assert.equal(status, 401, "should not leak whether the account exists via a different status/message");
});

test("Auth: malformed JSON body doesn't crash the server", async () => {
  const res = await fetch(`http://localhost:${PORT}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not valid json",
  });
  // Should fail gracefully (500 from our error handler), not hang or crash the process.
  assert.ok(res.status >= 400);
  // Confirm the server is still alive after a malformed request.
  const health = await request("POST", "/auth/login", { email: "x@x.com", password: "irrelevant1" });
  assert.equal(health.status, 401, "server should still be responsive after a bad request");
});

test("Session expiry: an expired token is rejected and cleaned up (bug fix regression test)", () => {
  const { userFromToken } = require("../_shared/store");
  const user = { id: uuid(), handle: "expiretest" };
  db.users.set(user.id, user);
  const token = issueToken(user.id);

  // Force the session into the past without waiting 30 real days.
  const session = db.sessions.get(token);
  session.expiresAt = Date.now() - 1000;
  db.sessions.set(token, session);

  const result = userFromToken(token);
  assert.equal(result, null, "expired token must not resolve to a user");
  assert.equal(db.sessions.has(token), false, "expired session should be cleaned up from the store");
});

test("Session expiry: a fresh token still works", () => {
  const { userFromToken } = require("../_shared/store");
  const user = { id: uuid(), handle: "freshtest" };
  db.users.set(user.id, user);
  const token = issueToken(user.id);

  const result = userFromToken(token);
  assert.equal(result.id, user.id);
});
