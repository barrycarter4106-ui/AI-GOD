# Architecture Changelog

Maintained by the Architecture Agent. Reviewed by the human at each checkpoint (Week 3, 6, 8, 12).

## Entry 1 — Initial scaffold
**Date:** Kickoff
**Action:** Read `Pulse_Architecture_Spec.md`, confirmed understanding, scaffolded repo structure and per-service `SCOPE.md` files. No code written yet — schema and contracts only.

**Gaps flagged, awaiting human decision before Backend/Real-Time agents begin implementation:**

| # | Gap | Blocks | Suggested default if no response by kickoff |
|---|---|---|---|
| 1 | Story expiry cleanup mechanism (scheduled job vs. DB TTL vs. query-time) | Story Service | Query-time filtering for MVP simplicity; revisit if scale demands a worker |
| 2 | Does `StoryContribution` expire independently or with parent `Story`? | Story Service | Expires with parent (simpler, matches "one moment" product framing) |
| 3 | No rate-limiting/abuse-prevention policy | Circle, Presence Services | Low priority at seed-test scale; add before soft launch (Week 17+) |
| 4 | Which OAuth providers, SMS verification vendor for phone auth | Auth Service | Human decision required — cost/vendor choice, not an engineering default |
| 5 | Concurrent viewer ceiling per story (WebSocket sizing) | Presence Service | Proposing 200 concurrent/story as a placeholder — confirm before build |

**Not blocking, but noted:**
- Reconnect handling policy for Presence Service needs a decision (immediate "left" vs. grace period).
- Reaction emoji set needs to come from Design Agent before Presence Service builds the reaction endpoint.
- Notification frequency caps need Content/Editing Agent input.

---
*Next entry should be logged when the human responds to the gaps above, or at the Week 3 checkpoint — whichever comes first.*
