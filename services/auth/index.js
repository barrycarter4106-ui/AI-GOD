// Auth Service
// Owns: User entity, signup/login/session
// Scope: services/auth/SCOPE.md
// Resolved decisions applied: email auth for MVP; OAuth (Google/Apple)
// and phone/SMS auth deferred — see SCOPE.md and ARCHITECTURE_CHANGELOG.md.

const http = require("http");
const crypto = require("crypto");
const url = require("url");
const { db, uuid, nowISO, issueToken } = require("../_shared/store");
const { sendJSON, readBody, matchRoute } = require("../_shared/http");

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

// Used when a login is attempted for an email that doesn't exist, so we
// still burn equivalent CPU and return in comparable time — otherwise a
// fast "no such user" response reveals which emails are registered.
const DUMMY_SALT = crypto.randomBytes(16).toString("hex");
const DUMMY_HASH = crypto.scryptSync("dummy-password-never-matches", DUMMY_SALT, 64).toString("hex");

async function handleSignup(req, res) {
  const body = await readBody(req);
  const { email, password, handle, display_name } = body;

  if (!email || !password || !handle) {
    return sendJSON(res, 400, { error: "email, password, and handle are required" });
  }
  // Bugs found in continued testing: neither of these was validated at
  // all before — "x" was accepted as a password, and "not-an-email" was
  // accepted as an email. Basic sanity checks, not full RFC validation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJSON(res, 400, { error: "email is not a valid format" });
  }
  if (password.length < 8) {
    return sendJSON(res, 400, { error: "password must be at least 8 characters" });
  }
  const existing = [...db.users.values()].find((u) => u.email === email || u.handle === handle);
  if (existing) {
    return sendJSON(res, 409, { error: "email or handle already in use" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  const user = {
    id: uuid(),
    handle,
    display_name: display_name || handle,
    avatar_url: "",
    created_at: nowISO(),
    auth_provider: "email",
    _salt: salt,
    _passwordHash: passwordHash,
    email,
  };
  db.users.set(user.id, user);

  const token = issueToken(user.id);
  const { _salt, _passwordHash, ...publicUser } = user;
  return sendJSON(res, 201, { user: publicUser, token });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const { email, password } = body;
  if (!email || !password) {
    return sendJSON(res, 400, { error: "email and password are required" });
  }
  const user = [...db.users.values()].find((u) => u.email === email);

  // SECURITY (found in cross-examination audit): this previously compared
  // password hashes with !==, which short-circuits on the first differing
  // byte and leaks timing information. Now uses crypto.timingSafeEqual.
  // We also always perform a hash operation even when the user doesn't
  // exist, so response time doesn't reveal whether an email is registered
  // (user enumeration).
  const salt = user ? user._salt : DUMMY_SALT;
  const candidate = Buffer.from(hashPassword(password, salt), "hex");
  const expected = user ? Buffer.from(user._passwordHash, "hex") : Buffer.from(DUMMY_HASH, "hex");

  const matches =
    candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);

  if (!user || !matches) {
    return sendJSON(res, 401, { error: "invalid credentials" });
  }
  const token = issueToken(user.id);
  const { _salt, _passwordHash, ...publicUser } = user;
  return sendJSON(res, 200, { user: publicUser, token });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname } = url.parse(req.url);
    try {
      if (req.method === "POST" && matchRoute("/auth/signup", pathname)) {
        return await handleSignup(req, res);
      }
      if (req.method === "POST" && matchRoute("/auth/login", pathname)) {
        return await handleLogin(req, res);
      }
      sendJSON(res, 404, { error: "not found" });
    } catch (err) {
      // SECURITY (cross-examination audit): this used to return
      // err.message to the client, leaking internal details that help an
      // attacker map the system. Log server-side, return a generic error.
      console.error("[auth] unhandled error:", err);
      sendJSON(res, 500, { error: "internal error" });
    }
  });
}

module.exports = { createServer };

if (require.main === module) {
  const PORT = process.env.AUTH_PORT || 4001;
  createServer().listen(PORT, () => console.log(`Auth Service listening on ${PORT}`));
}
