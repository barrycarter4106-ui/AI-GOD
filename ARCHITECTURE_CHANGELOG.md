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

## Entry 2 — Resolve architecture gaps (PR #1)
**Date:** Pre-Week 3 checkpoint
**Action:** Resolved 3 of 5 open gaps with concrete defaults, proposed for human sign-off in this PR.

| # | Gap | Resolution |
|---|---|---|
| 1 | Story expiry cleanup mechanism | Query-time filtering (`WHERE expires_at > now()`). No background worker for MVP. |
| 2 | StoryContribution expiry | Expires with parent Story — no independent field. |
| 5 | Concurrent viewer ceiling | 200 per story — well above 50–150 user seed-test scale. |

**Still open — needs human decision, not an engineering default:**
- #3 Rate limiting / abuse prevention — deferred to before soft launch (Week 17+), acceptable to leave open for seed test.
- #4 SMS verification vendor for phone auth — deferred; email + Google/Apple OAuth cover the MVP, phone auth can land after Week 8.

**Also resolved:** OAuth providers narrowed to Google + Apple (not a general "oauth" enum) — Apple Sign-In is effectively required if offering any third-party OAuth on iOS, per App Store guidelines.

**Not yet resolved, flagged for Real-Time Systems Agent before it starts building:**
- Reconnect handling policy (immediate "left" vs. grace period)
- Reaction emoji set (needs Design Agent input first)

---

## Entry 3 — Presence Service open decisions confirmed
**Date:** Post Real-Time Systems Agent kickoff
**Action:** Product owner confirmed both remaining open items from Entry 2/SCOPE.md.

| Decision | Proposed | Confirmed |
|---|---|---|
| Reconnect grace period | 15s | **30s** — prioritizes stable-feeling presence over split-second accuracy on flaky mobile connections |
| Reaction emoji set | ❤️ 😂 😮 🔥 👏 😢 | **Confirmed as proposed** — set is locked, final iconography still pending Design Agent |

See `services/presence/DECISIONS.md` for full reasoning. All 5 originally
flagged architecture gaps are now resolved except rate limiting and SMS
verification vendor, both deliberately deferred past Phase 0.

---
*Next entry should be logged at the Week 3 checkpoint, or when rate
limiting / SMS vendor decisions are made — whichever comes first.*
