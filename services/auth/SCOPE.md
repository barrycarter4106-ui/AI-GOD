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

## Resolved (see ARCHITECTURE_CHANGELOG.md, Entry 2)
- OAuth providers for MVP: **Google and Apple only** (both required for iOS App Store compliance if Apple Sign-In is offered as an option alongside Google).
- Phone auth SMS verification vendor: **still open** — needs a human decision on Twilio vs. alternatives before phone auth ships. Email + OAuth are sufficient for seed test; phone auth can land after Week 8.

## Out of scope
- Anything in spec Section 5 (no monetization, no DMs, etc.)
