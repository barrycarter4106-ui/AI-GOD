# Auth Service — Scope

**Owner:** Backend/API Agent
**Reviewed by:** Reviewer A

## Owns
- `User` entity (see `shared/types/models.ts` — do not redefine locally)
- Signup / login / session management

## Endpoints
```
POST /auth/signup
POST /auth/login
```

## Talks to
- Circle Service (on account creation, no direct DB access — use the API)

## Open questions blocking full implementation
- Which OAuth providers are in scope for launch? (`auth_provider` enum currently just says `oauth`)
- Does phone auth require SMS verification infra? This is a vendor/cost decision for the human to confirm, not something to assume.

## Out of scope
- Anything in spec Section 5 (no monetization, no DMs, etc.)
