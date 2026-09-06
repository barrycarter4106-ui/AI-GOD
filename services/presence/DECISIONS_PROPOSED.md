# Real-Time Systems Agent — Proposal on Open Decisions

Per the kickoff prompt, this agent proposes concrete defaults for the two
open items in `services/presence/SCOPE.md` rather than guessing silently.
**These are proposals, not final — confirm or override before this ships
past local testing.**

## 1. Reconnect handling

**Proposal: 15-second grace period before flipping a user's status to "left."**

Reasoning: mobile connections drop and reconnect constantly on network
switches (wifi ↔ cellular, elevators, subways). If presence flips to
"left" the instant a connection blips, the live viewer list will flicker
constantly and feel unreliable — which undermines the entire "real-time
shared moment" premise. A short grace period smooths this out. 15 seconds
is a starting point; if seed testing shows people genuinely leaving and
still showing as "watching," shorten it. If it flickers, lengthen it.

## 2. Reaction emoji set

**Proposal: 6 fixed reactions — ❤️ 😂 😮 🔥 👏 😢**

Reasoning: covers the emotional range needed for shared moments (love,
funny, shocked, hype, celebratory, sad) without free-text input, which
avoids moderation problems and keeps the reaction stream fast/glanceable.
This should ultimately come from the Design Agent (per SCOPE.md) — this
is an engineering placeholder to unblock building the endpoint, not a
final design decision.

## 3. "Friends watching" notification frequency

**Proposal: notify the story author once per room, on the first viewer's
join — not on every subsequent join.**

Reasoning: `services/notification/SCOPE.md` flags "notification frequency
caps per user per day" as an open question needing Content/Editing Agent
input, and explicitly warns against generic re-engagement pings. Notifying
on *every* join would spam an author whose story has a dozen viewers
trickle in over an hour. Firing once, on the transition from zero viewers
to one, keeps the notification meaningful ("someone's watching now")
without needing a real frequency-cap policy yet. This is a placeholder to
unblock wiring Presence to the Notification Service (per its own SCOPE.md:
"Talks to: Presence Service") — revisit once product specifies real caps.

---

**Implementation proceeds using these three defaults.** All are called out
in code comments at the exact point they're used, so they're easy to find
and change once you confirm or override them.
