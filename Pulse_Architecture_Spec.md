# Pulse — Architecture Spec & Agent Scope Document

**Purpose:** This is the shared reference every builder and reviewer agent works against. If an agent's output contradicts this doc, the doc wins — update it deliberately, don't let individual agents drift from it.

---

## 1. Core Data Model

### User
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | primary key |
| `handle` | string | unique, no public follower/like counts anywhere in the schema |
| `display_name` | string | |
| `avatar_url` | string | |
| `created_at` | timestamp | |
| `auth_provider` | enum | email, phone, oauth |

### Circle
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | primary key |
| `name` | string | e.g. "Spring Break Trip" |
| `owner_id` | UUID | FK → User |
| `theme` | JSON | color/emoji-set customization, phase 2 |
| `created_at` | timestamp | |
| `invite_token` | string | rotating, single active token per circle |

### CircleMember
| Field | Type | Notes |
|---|---|---|
| `circle_id` | UUID | FK → Circle |
| `user_id` | UUID | FK → User |
| `joined_at` | timestamp | |
| `role` | enum | owner, member |

### Story
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | primary key |
| `circle_id` | UUID | FK → Circle |
| `author_id` | UUID | FK → User |
| `media_url` | string | image/video, CDN-backed |
| `media_type` | enum | image, video |
| `created_at` | timestamp | |
| `expires_at` | timestamp | default `created_at` + 24h |
| `is_collaborative` | boolean | if true, allows contributions from other circle members |
| `collab_window_closes_at` | timestamp | nullable, only for collaborative stories |

### StoryContribution
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | primary key |
| `story_id` | UUID | FK → Story (parent collaborative story) |
| `contributor_id` | UUID | FK → User |
| `media_url` | string | |
| `created_at` | timestamp | |

### PresenceEvent (ephemeral — not persisted long-term)
| Field | Type | Notes |
|---|---|---|
| `story_id` | UUID | |
| `user_id` | UUID | |
| `status` | enum | viewing, left |
| `updated_at` | timestamp | TTL'd out of the store after story expiry |

### Reaction (ephemeral, append-only during viewing window)
| Field | Type | Notes |
|---|---|---|
| `story_id` | UUID | |
| `user_id` | UUID | |
| `emoji` | string | limited set, no free text |
| `created_at` | timestamp | |

**Design rule:** Presence and reactions are real-time/ephemeral data — they belong in a fast in-memory store (e.g. Redis) keyed by `story_id`, not the primary relational database. Only aggregate counts (if any) get written back to durable storage.

---

## 2. Service Boundaries & API Contracts

| Service | Owns | Talks to |
|---|---|---|
| **Auth Service** | User, sessions | Circle Service (on account creation) |
| **Circle Service** | Circle, CircleMember, invite tokens | Auth Service (verify user), Story Service (permission checks) |
| **Story Service** | Story, StoryContribution, media upload | Circle Service (membership checks), Media/CDN |
| **Presence Service** | PresenceEvent, Reaction (real-time layer) | Story Service (validate story is active) |
| **Notification Service** | push triggers | Presence Service (live activity), Circle Service (invites) |

### Key API contracts (REST unless noted)

```
POST   /auth/signup
POST   /auth/login
GET    /circles/:id
POST   /circles                         { name }
POST   /circles/:id/invite              → returns invite_token/link
POST   /circles/join/:invite_token
GET    /circles/:id/stories
POST   /circles/:id/stories             { media, is_collaborative }
POST   /stories/:id/contributions       { media }   [collaborative only]
WS     /presence/:story_id              — join/leave events, live reaction stream
POST   /stories/:id/react               { emoji }   [also emits over WS]
```

**Real-time layer:** WebSocket connection per active story view. Presence Service broadcasts join/leave and reaction events to all connected clients on that `story_id` channel. This is the highest-risk piece technically — plan for reconnect handling, and cap concurrent viewers per story generously above what you expect at seed-test scale.

---

## 3. Agent Scope Assignments

Each agent works **only** within its scope. Cross-cutting changes (e.g., a schema change) go through the Architecture Agent first.

| # | Agent | Scope | Reports to / reviewed by |
|---|---|---|---|
| 1 | **Architecture Agent** | Owns this document, data model, API contracts | You (human checkpoint) |
| 2 | **Backend/API Agent** | Auth Service, Circle Service, Story Service (REST layer) | Reviewer A |
| 3 | **Real-Time Systems Agent** | Presence Service, WebSocket layer, Redis schema | Reviewer A |
| 4 | **Frontend/Mobile UI Agent** | Camera screen, story feed, profile, circle screens | Reviewer B |
| 5 | **Design Agent** | Visual system, icon set, reaction animations, filters | Reviewer B |
| 6 | **QA/Testing Agent** | Writes/runs tests against Agents 2–5's output continuously | — (feeds Reviewer A & B) |
| 7 | **Troubleshooting Agent** | Triages bugs QA finds, reproduces, routes fix back to owning agent | — (feeds Reviewer A & B) |
| 8 | **Data/Analysis Agent** | Instrumentation, seed-test metrics, retention tracking | Reviewer C |
| 9 | **Content/Editing Agent** | In-app copy, onboarding text, notification copy | Reviewer C |
| 10 | **Visualization/Reporting Agent** | Turns Agent 8's data into dashboards/decks for you | Reviewer C |

### Reviewer agents (3, not 20)

| Reviewer | Oversees | Checks for |
|---|---|---|
| **Reviewer A** | Agents 2, 3 (backend + real-time) | Schema/contract conformance, security, scalability red flags |
| **Reviewer B** | Agents 4, 5 (frontend + design) | UI matches design system, no scope creep into backend logic |
| **Reviewer C** | Agents 8, 9, 10 (data + content + reporting) | Accuracy, no metrics vanity-driving decisions, copy tone consistency |

QA (6) and Troubleshooting (7) run continuously and report findings to whichever reviewer owns the affected area — they aren't a 4th oversight layer, they're part of the build loop.

---

## 4. Human Checkpoints (from the roadmap)

| Checkpoint | When | You review |
|---|---|---|
| Core infra complete | End of Week 3 | Auth, circle creation, invite flow working end-to-end |
| Real-time presence live | End of Week 6 | Presence + reactions working under simulated concurrent load |
| MVP complete | End of Week 8 | Full core loop: create circle → go live → react → collaborative story |
| Seed test results | End of Week 12 | Retention data from Agent 8/10 — go/no-go on iterating vs. pivoting |

**Rule of thumb:** if an agent's output can't be checked against a row in this document, it's out of scope until the document is updated — deliberately, by you or the Architecture Agent, not by an agent improvising.

---

## 5. What's explicitly OUT of scope for Phase 0 (weeks 1–8)

- Public discovery/algorithmic feed
- Monetization/payments
- DMs
- Vibe/theme customization beyond a basic name
- Milestone reels, countdown-anchored stories
- Any feature not listed in the Slide 5–7 core loop from the pitch deck

Keeping this list visible prevents 10 agents from "helpfully" adding scope you didn't ask for.
