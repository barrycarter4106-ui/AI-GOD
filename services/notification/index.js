// Notification Service
// Scope: services/notification/SCOPE.md
//
// Per the kickoff prompt: full implementation depends on the Real-Time
// Systems Agent's presence events, which are being built in parallel.
// This is the interface/contract only — a real push provider (APNs/FCM)
// integration comes later.
//
// Design principle (carried over from product strategy): notifications
// should be sparse and tied to real-time activity only — no generic
// re-engagement pings. Don't let this default to aggressive growth-app
// push patterns later.

const triggered = []; // in-memory log, for testing/inspection only

/**
 * Call this from the Presence Service when live activity happens.
 * type: "friends_watching" | "circle_invite" | "collab_story_opened"
 */
function notify(userId, type, payload) {
  const event = { userId, type, payload, at: new Date().toISOString() };
  triggered.push(event);
  // TODO: real push integration (APNs/FCM) — not built yet, this just
  // logs the intent so the contract can be tested end-to-end.
  return event;
}

function getTriggeredFor(userId) {
  return triggered.filter((e) => e.userId === userId);
}

module.exports = { notify, getTriggeredFor, _triggered: triggered };
