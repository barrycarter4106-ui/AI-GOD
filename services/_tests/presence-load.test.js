const test = require("node:test");
const assert = require("node:assert/strict");
const { connect } = require("./ws-client");
const { db, issueToken, uuid } = require("../_shared/store");

const presence = require("../presence/index");
const PORT = 5220;
let server;

function waitFor(ws, predicate, timeoutMs = 3000) {
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

test("Presence: reconnecting within the grace period does NOT broadcast 'left'", async () => {
  const userA = { id: uuid(), handle: "reconnecter" };
  const userB = { id: uuid(), handle: "observer" };
  db.users.set(userA.id, userA);
  db.users.set(userB.id, userB);
  const tokenA = issueToken(userA.id);
  const tokenB = issueToken(userB.id);
  const storyId = uuid();

  // Observer connects first, watching for any "left" event for userA.
  const wsB = await connect(PORT, `/presence/${storyId}`);
  let sawLeft = false;
  wsB.onMessage((raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === "presence" && msg.status === "left" && msg.user_id === userA.id) sawLeft = true;
  });
  wsB.send(JSON.stringify({ type: "identify", token: tokenB }));

  // userA connects, then immediately disconnects and reconnects — well
  // within the confirmed 30s grace period.
  const wsA1 = await connect(PORT, `/presence/${storyId}`);
  wsA1.send(JSON.stringify({ type: "identify", token: tokenA }));
  await new Promise((r) => setTimeout(r, 100));
  wsA1.close();

  await new Promise((r) => setTimeout(r, 200)); // brief pause, simulating a network blip
  const wsA2 = await connect(PORT, `/presence/${storyId}`);
  const rejoined = waitFor(wsB, (m) => m.type === "presence" && m.status === "viewing" && m.user_id === userA.id);
  wsA2.send(JSON.stringify({ type: "identify", token: tokenA }));
  await rejoined;

  assert.equal(sawLeft, false, "a reconnect within the grace period must not broadcast 'left'");

  wsA2.close();
  wsB.close();
});

test("Presence: story at the 200-viewer ceiling rejects new joins", async () => {
  const storyId = uuid();
  const connections = [];

  // Fill the room to exactly the ceiling.
  for (let i = 0; i < presence.CONCURRENT_VIEWER_CEILING; i++) {
    const user = { id: uuid(), handle: `viewer${i}` };
    db.users.set(user.id, user);
    const token = issueToken(user.id);
    const ws = await connect(PORT, `/presence/${storyId}`);
    ws.send(JSON.stringify({ type: "identify", token }));
    connections.push(ws);
  }
  // Give the server a moment to process all the identify messages.
  await new Promise((r) => setTimeout(r, 500));

  // The 201st viewer should be rejected.
  const overflowUser = { id: uuid(), handle: "overflow" };
  db.users.set(overflowUser.id, overflowUser);
  const overflowToken = issueToken(overflowUser.id);
  const overflowWs = await connect(PORT, `/presence/${storyId}`);

  const rejection = waitFor(overflowWs, (m) => m.type === "error" && m.reason === "story_at_capacity");
  overflowWs.send(JSON.stringify({ type: "identify", token: overflowToken }));
  const msg = await rejection;
  assert.equal(msg.reason, "story_at_capacity");

  connections.forEach((ws) => ws.close());
});
