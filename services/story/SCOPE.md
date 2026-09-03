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

## Resolved (see ARCHITECTURE_CHANGELOG.md, Entry 2)
- **Expiry cleanup**: query-time filtering (`WHERE expires_at > now()`) for MVP. No background worker needed at seed-test scale. Revisit if a scheduled purge job becomes necessary for storage/cost reasons post-launch.
- **Contribution expiry**: `StoryContribution` always expires with its parent `Story` — no independent `expires_at` field.

## Out of scope
- Algorithmic/discovery feed
- Highlight reel compilation (Phase 2 feature)
