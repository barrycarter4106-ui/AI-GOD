# Story Service — Scope

**Owner:** Backend/API Agent
**Reviewed by:** Reviewer A

## Owns
- `Story`, `StoryContribution` entities (see `shared/types/models.ts`)
- Media upload handoff to CDN

## Endpoints
```
GET  /circles/:id/stories
POST /circles/:id/stories          { media, is_collaborative }
POST /stories/:id/contributions    { media }   [collaborative only]
```

## Talks to
- Circle Service (membership checks before allowing post/view)
- Media/CDN (upload, not owned by this service)
- Presence Service (validates a story is still active before a WS connection opens)

## Open questions — resolve before full implementation
- **Expiry cleanup mechanism**: is `expires_at` enforced by a scheduled job, DB TTL, or checked at query-time only? This changes whether this service needs a background worker.
- **Contribution expiry**: does a `StoryContribution` expire independently or always with its parent `Story`? Spec doesn't say — default assumption until confirmed: contributions expire with the parent.

## Out of scope
- Algorithmic/discovery feed
- Highlight reel compilation (Phase 2 feature)
