// Auth Service
// Owns: User entity, signup/login/session
// Scope: services/auth/SCOPE.md
// Resolved decisions applied: email auth for MVP; OAuth (Google/Apple)
// and phone/SMS auth deferred — see SCOPE.md and ARCHITECTURE_CHANGELOG.md.

const http = require("http");
const crypto = require("crypto");
const url = require("url");
const { db, uuid, nowISO, issueToken, userFromToken } = require("../_shared/store");
const { sendJSON, readBody, matchRoute, authHeader } = require("../_shared/http");

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function handleSignup(req, res) {
  const body = await readBody(req);
  const { email, password, handle, display_name } = body;

  if (!email || !password || !handle) {
    return sendJSON(res, 400, { error: "email, password, and handle are required" });
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
  if (!user || hashPassword(password, user._salt) !== user._passwordHash) {
    return sendJSON(res, 401, { error: "invalid credentials" });
  }
  const token = issueToken(user.id);
  const { _salt, _passwordHash, ...publicUser } = user;
  return sendJSON(res, 200, { user: publicUser, token });
}

// Called by other services to resolve a token they received but can't
// look up themselves — Auth is the only service that owns db.sessions.
// Least privilege: callers only ever need the user's id (see
// authClient.js consumers), so that's all this returns — no email or
// other profile fields leave this service over this path.
function handleVerify(req, res) {
  const token = authHeader(req);
  const user = token && userFromToken(token);
  if (!user) return sendJSON(res, 401, { error: "invalid or expired token" });
  return sendJSON(res, 200, { user: { id: user.id } });
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
      if (req.method === "GET" && matchRoute("/auth/verify", pathname)) {
        return handleVerify(req, res);
      }
      sendJSON(res, 404, { error: "not found" });
    } catch (err) {
      sendJSON(res, 500, { error: "internal error", detail: err.message });
    }
  });
}

module.exports = { createServer };

if (require.main === module) {
  const PORT = process.env.AUTH_PORT || 4001;
  createServer().listen(PORT, () => console.log(`Auth Service listening on ${PORT}`));
}
