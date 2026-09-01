// Full journey test: two real users, across all four services, doing
// exactly what the frontend's flow does — signup, create/join a circle,
// post a story, watch it live with presence, react, and confirm a
// non-member is locked out throughout. This is the test that would have
// caught bugs 3 and 4 from the engineering review if it had existed
// before that pass — formalizing it now as permanent regression coverage.

const test = require("node:test");
const assert = require("node:assert/strict");
const { connect } = require("./ws-client");

const authServer = require("../auth/index").createServer();
const circleServer = require("../circle/index").createServer();
const storyServer = require("../story/index").createServer();
const presenceServer = require("../presence/index").createServer();

const PORTS = { auth: 5401, circle: 5402, story: 5403, presence: 5404 };

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

test.before(async () => {
  await Promise.all([
    new Promise((r) => authServer.listen(PORTS.auth, r)),
    new Promise((r) => circleServer.listen(PORTS.circle, r)),
    new Promise((r) => storyServer.listen(PORTS.story, r)),
    new Promise((r) => presenceServer.listen(PORTS.presence, r)),
  ]);
});

test.after(() => {
  authServer.close();
  circleServer.close();
  storyServer.close();
  presenceServer.close();
});

test("Full journey: two friends create a circle, share a live moment, and react together", async () => {
  // 1. Both users sign up.
  const alice = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "alice@journey.test", password: "aliceIsCool1", handle: "alice_j",
  });
  const bob = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "bob@journey.test", password: "bobIsCoolToo1", handle: "bob_j",
  });
  assert.equal(alice.status, 201);
  assert.equal(bob.status, 201);

  // 2. Alice creates a circle and gets an invite link.
  const circle = await api(PORTS.circle, "POST", "/circles", { name: "Journey Test Trip" }, alice.body.token);
  assert.equal(circle.status, 201);
  const invite = await api(PORTS.circle, "POST", `/circles/${circle.body.id}/invite`, {}, alice.body.token);
  const inviteToken = invite.body.invite_link.split("/").pop();

  // 3. Bob joins via the link.
  const join = await api(PORTS.circle, "POST", `/circles/join/${inviteToken}`, {}, bob.body.token);
  assert.equal(join.status, 200);
  assert.equal(join.body.id, circle.body.id);

  // 4. A stranger (never joined) should NOT be able to post to the circle.
  const stranger = await api(PORTS.auth, "POST", "/auth/signup", {
    email: "stranger@journey.test", password: "strangerpass1", handle: "stranger_j",
  });
  const blockedPost = await api(
    PORTS.story, "POST", `/circles/${circle.body.id}/stories`,
    { media_url: "https://cdn.pulse.app/intrusion.jpg", media_type: "image" },
    stranger.body.token
  );
  assert.equal(blockedPost.status, 403, "a non-member must never be able to post into the circle");

  // 5. Alice posts a collaborative story.
  const story = await api(
    PORTS.story, "POST", `/circles/${circle.body.id}/stories`,
    { media_url: "https://cdn.pulse.app/journey.jpg", media_type: "image", is_collaborative: true },
    alice.body.token
  );
  assert.equal(story.status, 201);

  // 6. Both connect to live presence; Alice should see Bob's join event.
  const aliceWs = await connect(PORTS.presence, `/presence/${story.body.id}`);
  const seeBobJoin = new Promise((resolve) => {
    aliceWs.onMessage((raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "presence" && msg.status === "viewing" && msg.user_id === bob.body.user.id) resolve(msg);
    });
  });
  aliceWs.send(JSON.stringify({ type: "identify", token: alice.body.token }));
  await new Promise((r) => setTimeout(r, 100));

  const bobWs = await connect(PORTS.presence, `/presence/${story.body.id}`);
  bobWs.send(JSON.stringify({ type: "identify", token: bob.body.token }));

  const joinEvent = await seeBobJoin;
  assert.equal(joinEvent.viewer_count, 2, "Alice should see the viewer count go to 2 when Bob joins");

  // 7. Bob contributes to the collaborative story.
  const contribution = await api(
    PORTS.story, "POST", `/stories/${story.body.id}/contributions`,
    { media_url: "https://cdn.pulse.app/bob-added-this.jpg" },
    bob.body.token
  );
  assert.equal(contribution.status, 201);

  // 8. Bob reacts, Alice sees it live.
  const seeReaction = new Promise((resolve) => {
    aliceWs.onMessage((raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "reaction") resolve(msg);
    });
  });
  await api(PORTS.presence, "POST", `/stories/${story.body.id}/react`, { emoji: "🔥" }, bob.body.token);
  const reaction = await seeReaction;
  assert.equal(reaction.emoji, "🔥");
  assert.equal(reaction.user_id, bob.body.user.id);

  // 9. Confirm the story + its contribution both show up when listed.
  const listed = await api(PORTS.story, "GET", `/circles/${circle.body.id}/stories`, null, alice.body.token);
  const found = listed.body.find((s) => s.id === story.body.id);
  assert.ok(found, "the story must appear in the circle's story list");
  assert.equal(found.contributions.length, 1, "Bob's contribution must be attached to the story");

  aliceWs.close();
  bobWs.close();
});
