# Notification Service — Scope

**Owner:** Backend/API Agent
**Reviewed by:** Reviewer A

## Owns
- Push notification triggers only — no new data entities of its own

## Talks to
- Presence Service (live activity — e.g. someone went live, friends are watching)
- Circle Service (invite notifications)

## Design principle (from product strategy, not just engineering)
Notifications should be sparse and tied to real-time activity only — "3 friends are watching X's story right now," not generic re-engagement pings. This was a deliberate product decision earlier in planning; don't let this service default to aggressive push patterns typical of growth-stage social apps.

## Open questions
- Notification frequency caps per user per day — not yet specified, should be decided alongside Content/Editing Agent (owns notification copy).

## Out of scope
- Email notifications (Phase 2)
- Any notification not tied to live/real-time activity
