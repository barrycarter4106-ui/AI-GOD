# Pulse — Security Audit

Full review of all 9 production files (~1,375 LOC) across frontend and
backend. Every finding below was verified by reading the code, and the
fixes are locked in by `services/_tests/security-audit.test.js` (13 tests)
so they can't silently regress.

---

## Fixed in this pass

| # | Severity | Finding | Where | Fix |
|---|---|---|---|---|
| 1 | **High** | Unbounded request body — a single multi-GB request would exhaust memory and crash the process. Very reachable, since the frontend posts photos as base64 data URLs. | `_shared/http.js` | 10MB cap; connection destroyed on breach rather than continuing to buffer |
| 2 | **High** | Timing-unsafe password comparison using `!==`, which short-circuits on the first differing byte and leaks timing information | `auth/index.js` | `crypto.timingSafeEqual` |
| 3 | **Medium** | User enumeration — a nonexistent email returned much faster than a wrong password, revealing which emails are registered | `auth/index.js` | Always performs an equivalent hash operation against a dummy salt/hash |
| 4 | **Medium** | Internal error messages returned to clients in 500 responses, helping an attacker map the system | `auth`, `circle`, `story` | Logged server-side, generic message returned |
| 5 | **Low** | Non-object JSON bodies (arrays, strings) passed through to handlers that destructure them as objects, producing confusing behavior instead of a clean 400 | `_shared/http.js` | Explicit type check |

## Verified secure (checked, no change needed)

- **Password material never leaves the server.** `_salt` and `_passwordHash` are stripped from every response; tests assert the plaintext password is never echoed back either.
- **Cross-user access control holds.** Bob cannot read, list, post to, or generate invites for Alice's circle, and cannot read her individual story. Five separate tests cover this.
- **Forged tokens are rejected** across every authenticated endpoint.
- **Prototype pollution is not reachable** — handlers read named fields directly rather than merging request bodies into objects. Verified experimentally, not assumed.
- **Token is held in memory only, not `localStorage`** — deliberately, so an XSS bug can't trivially exfiltrate a persistent session. Tradeoff is logout on refresh; correct default for now.
- **Passwords hashed with scrypt** and a per-user random salt.

---

## Known risks — NOT fixed, accepted deliberately

These are real. They're acceptable for a Phase 0 seed test with 50–150
known users, and **must** be addressed before any public launch.

1. **Plain HTTP in the frontend config.** Bearer tokens and the WebSocket
   `identify` message travel in cleartext. Must become `https://`/`wss://`
   before deployment anywhere real. Documented inline in `frontend/index.html`.
2. **No rate limiting anywhere.** Login is brute-forceable; invite tokens
   and reactions can be spammed. Deferred by earlier architecture decision
   (changelog Entry 2), tracked, not forgotten.
3. **`scryptSync` blocks the event loop.** Under concurrent login load this
   serializes requests and becomes a DoS vector. Switch to async `scrypt`
   when moving off the prototype HTTP layer.
4. **In-memory store, no real database.** All data is lost on restart and
   there's no encryption at rest. Known from day one — swap for Postgres.
5. **Hand-rolled WebSocket implementation.** Not spec-complete (no
   fragmentation handling) and not security-hardened the way the `ws`
   package is. Documented in `_shared/ws-lite.js`.
6. **No CSRF protection or CORS policy.** Not currently exploitable given
   token-in-header auth and no cookie usage, but needs a deliberate policy
   before browsers from other origins hit these services.

---

## What this audit did NOT cover

Stated plainly so the coverage isn't overestimated:

- **No automated DAST/vulnerability scanning.** A tool like StackHawk
  tests systematically; this audit found what a careful reader thought to
  look for. Those are different kinds of coverage, and the second doesn't
  replace the first.
- **No dependency vulnerability scan** — though the attack surface here is
  unusually small, since there are zero third-party runtime dependencies.
- **No load or concurrency testing.** Race conditions under real parallel
  traffic remain untested.
- **No penetration testing** by an independent party.

The right next step before real users is a scan against a deployed
instance running the production stack (Express, Postgres, real `ws`),
not another manual pass over this prototype.
