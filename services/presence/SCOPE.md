# Presence Service — Scope

**Owner:** Real-Time Systems Agent
**Reviewed by:** Reviewer A (highest scrutiny — this is the riskiest service)

## Owns
- `PresenceEvent`, `Reaction` (ephemeral — Redis or equivalent, NOT the primary DB)
- WebSocket connection lifecycle per active story view

## Endpoints
```
WS   /presence/:story_id     — join/leave events, live reaction stream
POST /stories/:id/react      { emoji }   [also emits over WS]
```

## Talks to
- Story Service (validate the story is still active before accepting a connection)
- Notification Service (live activity triggers, e.g. "3 friends watching now")

## Open questions — MUST resolve before implementation starts
- **Concurrent viewer ceiling**: spec says "cap generously above expected seed-test scale" but gives no number. Propose a concrete ceiling (e.g. 200 concurrent connections per story) for human sign-off before building.
- **Reconnect handling**: what happens to a user's presence state on a dropped connection — immediate "left" status, or a grace period? Needs a decision, not an assumption.
- **Emoji set**: "limited set" is specified but the actual list isn't. Get this from Design Agent before building the reaction endpoint.

## Out of scope
- Persisting reaction history beyond the story's active window
- Anything resembling read receipts or exact online/offline status (spec explicitly avoids this — ambient presence only, not surveillance-level visibility)
