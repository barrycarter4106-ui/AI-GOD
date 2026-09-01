# Circle Service — Scope

**Owner:** Backend/API Agent
**Reviewed by:** Reviewer A

## Owns
- `Circle`, `CircleMember` entities (see `shared/types/models.ts`)
- Invite token generation and validation

## Endpoints
```
GET  /circles/:id
POST /circles                    { name }
POST /circles/:id/invite         -> returns invite_token/link
POST /circles/join/:invite_token
```

## Talks to
- Auth Service (verify user identity)
- Story Service (membership checks — is this user allowed to view/post in this circle?)

## Open questions
- Rate limit on invite token generation/use? No abuse-prevention policy is specified yet — low risk at seed-test scale (50–150 users) but flag before public soft launch.

## Out of scope
- Public/discoverable circles (Phase 2, not Phase 0)
- Circle theming beyond storing the `theme` field (Design Agent handles rendering, not this service)
