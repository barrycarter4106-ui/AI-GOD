# Real-Time Systems Agent — Confirmed Decisions

Both open items in `services/presence/SCOPE.md` have been confirmed by
the product owner. These are no longer proposals.

## 1. Reconnect handling

**Confirmed: 30-second grace period before flipping a user's status to "left."**

Chosen over the originally proposed 15s to further smooth out flaky
mobile connections — prioritizing a stable-feeling viewer list over
split-second accuracy. If seed testing shows this reads as inaccurate
(e.g. people who've genuinely left still showing as "watching" for too
long), revisit and shorten.

## 2. Reaction emoji set

**Confirmed: 6 fixed reactions — ❤️ 😂 😮 🔥 👏 😢**

Confirmed as originally proposed. Still a placeholder pending the Design
Agent's actual visual/animation treatment (per SCOPE.md) — the *set* is
locked, but final iconography/rendering is Design's call.

---

Implementation in `services/presence/index.js` reflects both confirmed
values.
